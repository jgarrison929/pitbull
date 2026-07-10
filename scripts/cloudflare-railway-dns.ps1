#Requires -Version 5.1
<#
.SYNOPSIS
  Sync Railway custom-domain DNS requirements to Cloudflare for pcserp.app.

.DESCRIPTION
  Reads required CNAME + TXT verification records from Railway CLI, then creates or
  updates matching records in Cloudflare (DNS only / gray cloud for CNAMEs).

  Requires CLOUDFLARE_API_TOKEN with Zone.DNS Edit on pcserp.app.

.PARAMETER Zone
  Cloudflare zone name (default: pcserp.app)

.PARAMETER ApiService
  Railway API service name (default: pitbull)

.PARAMETER WebService
  Railway web service name (default: pitbull-web)

.PARAMETER DryRun
  Print planned changes without calling Cloudflare API.

.EXAMPLE
  $env:CLOUDFLARE_API_TOKEN = "<token>"
  .\scripts\cloudflare-railway-dns.ps1

.EXAMPLE
  .\scripts\cloudflare-railway-dns.ps1 -DryRun
#>
param(
    [string]$Zone = "pcserp.app",
    [string]$ApiService = "pitbull",
    [string]$WebService = "pitbull-web",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Assert-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command not found: $Name"
    }
}

function Get-RailwayDomainStatus {
    param([string]$Service, [string]$Domain)
    $json = railway domain status $Domain -s $Service --json 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Failed to read Railway domain status for $Domain on $Service`: $json" }
    return $json | ConvertFrom-Json
}

function Get-CloudflareHeaders {
    $token = $env:CLOUDFLARE_API_TOKEN
    if ([string]::IsNullOrWhiteSpace($token)) {
        $token = $env:CF_API_TOKEN
    }
    if ([string]::IsNullOrWhiteSpace($token)) {
        throw @"
CLOUDFLARE_API_TOKEN is not set.

Create a token at https://dash.cloudflare.com/profile/api-tokens
  Template: Edit zone DNS
  Zone Resources: Include -> Specific zone -> pcserp.app

Then run:
  `$env:CLOUDFLARE_API_TOKEN = '<token>'
  .\scripts\cloudflare-railway-dns.ps1
"@
    }
    return @{
        Authorization = "Bearer $token"
        "Content-Type"  = "application/json"
    }
}

function Invoke-CloudflareApi {
    param(
        [string]$Method,
        [string]$Uri,
        [object]$Body = $null
    )
    $headers = Get-CloudflareHeaders
    $params = @{
        Method  = $Method
        Uri     = $Uri
        Headers = $headers
    }
    if ($null -ne $Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 6 -Compress)
    }
    $response = Invoke-RestMethod @params
    if (-not $response.success) {
        $errors = ($response.errors | ForEach-Object { $_.message }) -join "; "
        throw "Cloudflare API error: $errors"
    }
    return $response
}

function Get-ZoneId {
    param([string]$ZoneName)
    $encoded = [uri]::EscapeDataString($ZoneName)
    $result = Invoke-CloudflareApi -Method GET -Uri "https://api.cloudflare.com/client/v4/zones?name=$encoded&status=active"
    $zone = $result.result | Select-Object -First 1
    if (-not $zone) { throw "Cloudflare zone not found: $ZoneName" }
    return $zone.id
}

function Get-DnsRecords {
    param([string]$ZoneId)
    $records = @()
    $page = 1
    do {
        $result = Invoke-CloudflareApi -Method GET -Uri "https://api.cloudflare.com/client/v4/zones/$ZoneId/dns_records?per_page=100&page=$page"
        $records += $result.result
        $page++
    } while ($result.result_info.total_pages -ge $page)
    return $records
}

function New-DesiredRecord {
    param(
        [string]$Type,
        [string]$Name,
        [string]$Content,
        [bool]$Proxied = $false
    )
    [pscustomobject]@{
        type    = $Type
        name    = $Name
        content = $Content
        proxied = $Proxied
        ttl     = 1
    }
}

function Get-RecordFqdn {
    param([string]$Name, [string]$ZoneName)
    if ($Name -eq $ZoneName -or $Name -eq "@") { return $ZoneName }
    if ($Name.EndsWith(".$ZoneName")) { return $Name }
    return "$Name.$ZoneName"
}

function Sync-DnsRecord {
    param(
        [string]$ZoneId,
        [string]$ZoneName,
        [array]$Existing,
        [pscustomobject]$Desired,
        [switch]$DryRun
    )

    $fqdn = Get-RecordFqdn -Name $Desired.name -ZoneName $ZoneName
    $match = $Existing | Where-Object {
        $_.type -eq $Desired.type -and (
            $_.name -eq $Desired.name -or
            $_.name -eq $fqdn
        )
    } | Select-Object -First 1

    $action = if ($match) { "update" } else { "create" }
    $needsChange = $false
    if ($match) {
        $needsChange = (
            $match.content -ne $Desired.content -or
            ($Desired.type -eq "CNAME" -and [bool]$match.proxied -ne $Desired.proxied)
        )
    } else {
        $needsChange = $true
    }

    $proxyLabel = if ($Desired.type -eq "CNAME") {
        if ($Desired.proxied) { "proxied" } else { "DNS only" }
    } else { "n/a" }

    if (-not $needsChange) {
        Write-Host "OK   $($Desired.type) $($Desired.name) -> $($Desired.content) ($proxyLabel)" -ForegroundColor DarkGray
        return
    }

    Write-Host "$($action.ToUpper()) $($Desired.type) $($Desired.name) -> $($Desired.content) ($proxyLabel)" -ForegroundColor Yellow

    if ($DryRun) { return }

    $body = @{
        type    = $Desired.type
        name    = $Desired.name
        content = $Desired.content
        ttl     = $Desired.ttl
    }
    if ($Desired.type -eq "CNAME") {
        $body.proxied = $Desired.proxied
    }

    if ($match) {
        Invoke-CloudflareApi -Method PUT -Uri "https://api.cloudflare.com/client/v4/zones/$ZoneId/dns_records/$($match.id)" -Body $body | Out-Null
    } else {
        Invoke-CloudflareApi -Method POST -Uri "https://api.cloudflare.com/client/v4/zones/$ZoneId/dns_records" -Body $body | Out-Null
    }
}

Assert-Command railway
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host "Reading Railway DNS requirements..." -ForegroundColor Cyan
# Web: app + demo (same pitbull-web service). API: api.
$webDomains = @("app.$Zone", "demo.$Zone")
$statuses = @()
foreach ($d in $webDomains) {
    try {
        $statuses += Get-RailwayDomainStatus -Service $WebService -Domain $d
    } catch {
        Write-Host "WARN: could not read Railway domain status for $d on $WebService - $($_.Exception.Message)" -ForegroundColor Yellow
    }
}
try {
    $statuses += Get-RailwayDomainStatus -Service $ApiService -Domain "api.$Zone"
} catch {
    Write-Host "WARN: could not read Railway domain status for api.$Zone on $ApiService - $($_.Exception.Message)" -ForegroundColor Yellow
}

$desired = @()

foreach ($status in $statuses) {
    foreach ($record in $status.domain.dnsRecords) {
        if ($record.recordType -ne "DNS_RECORD_TYPE_CNAME") { continue }
        $desired += New-DesiredRecord -Type "CNAME" -Name $record.name -Content $record.requiredValue -Proxied $false
    }
    if ($status.domain.verification -and -not $status.domain.verification.verified) {
        $desired += New-DesiredRecord -Type "TXT" -Name $status.domain.verification.dnsHost -Content $status.domain.verification.token
    }
}

if ($desired.Count -eq 0) {
    throw "No DNS records discovered from Railway. Ensure custom domains exist (app/demo/api.$Zone)."
}

Write-Host ""
Write-Host "=== Planned Cloudflare DNS for $Zone ===" -ForegroundColor Cyan
$desired | ForEach-Object {
    $proxy = if ($_.type -eq "CNAME") { "DNS only" } else { "" }
    Write-Host ("  {0} {1} -> {2} {3}" -f $_.type, $_.name, $_.content, $proxy)
}
Write-Host ""

if ($DryRun) {
    Write-Host "Dry run only - no Cloudflare changes made." -ForegroundColor Yellow
    exit 0
}

$zoneId = Get-ZoneId -ZoneName $Zone
$existing = Get-DnsRecords -ZoneId $zoneId

foreach ($record in $desired) {
    Sync-DnsRecord -ZoneId $zoneId -ZoneName $Zone -Existing $existing -Desired $record
}

Write-Host ""
Write-Host "Done. Railway SSL verification may take 5-15 minutes." -ForegroundColor Green
Write-Host "Check status:" -ForegroundColor Cyan
Write-Host ('  railway domain status app.' + $Zone + ' -s ' + $WebService)
Write-Host ('  railway domain status demo.' + $Zone + ' -s ' + $WebService)
Write-Host ('  railway domain status api.' + $Zone + ' -s ' + $ApiService)