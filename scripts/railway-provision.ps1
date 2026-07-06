#Requires -Version 5.1
<#
.SYNOPSIS
  Provision Pitbull on Railway via CLI (idempotent).

.DESCRIPTION
  Configures project dependable-heart with pitbull (API), pitbull-web, and Postgres.
  Uses --skip-deploys on variable changes to avoid extra deploys.
  After provisioning, push to main once — GitHub auto-deploy handles builds.

.PARAMETER Project
  Railway project name or ID

.PARAMETER Redeploy
  Redeploy API + Web without a new commit (use sparingly — one trigger only)

.EXAMPLE
  .\scripts\railway-provision.ps1
#>
param(
    [string]$Project = "dependable-heart",
    [switch]$Redeploy
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

function Assert-RailwayCli {
    railway whoami 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Not logged in. Run: railway login" }
}

function New-RandomSecret {
    param([int]$Length = 48)
    $bytes = New-Object byte[] $Length
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', 'x').Replace('/', 'y').Substring(0, $Length)
}

Assert-RailwayCli
Set-Location $repoRoot
railway link -p $Project 2>&1 | Out-Null

# Ensure pitbull-web exists
$services = railway service list --json 2>&1 | ConvertFrom-Json
if (-not ($services | Where-Object { $_.name -eq "pitbull-web" })) {
    Write-Host "Creating pitbull-web service..." -ForegroundColor Yellow
    railway add --repo jgarrison929/pitbull --branch main --service pitbull-web --json 2>&1 | Out-Null
}

# --- API ---
Write-Host "`n=== pitbull (API) ===" -ForegroundColor Green
railway service link pitbull 2>&1 | Out-Null

$vars = railway variables --json -s pitbull 2>&1 | ConvertFrom-Json
$jwtKey = if ($vars.Jwt__Key) { $vars.Jwt__Key } else { New-RandomSecret }
$demoPw = if ($vars.Demo__UserPassword) { $vars.Demo__UserPassword } else { New-RandomSecret -Length 16 }

$apiDomain = railway domain list -s pitbull --json 2>&1 | ConvertFrom-Json
$apiUrl = if ($apiDomain.domains) { "https://$($apiDomain.domains[0].domain)" } else {
    $created = railway domain -s pitbull --json 2>&1 | ConvertFrom-Json
    $created.domain
}
Write-Host "API: $apiUrl"

# --- Web ---
Write-Host "`n=== pitbull-web ===" -ForegroundColor Green
railway service link pitbull-web 2>&1 | Out-Null

$webDomain = railway domain list -s pitbull-web --json 2>&1 | ConvertFrom-Json
$webUrl = if ($webDomain.domains) { "https://$($webDomain.domains[0].domain)" } else {
    $created = railway domain -s pitbull-web --json 2>&1 | ConvertFrom-Json
    $created.domain
}
Write-Host "Web: $webUrl"

# Set all variables with --skip-deploys (single deploy comes from git push)
railway variables set -s pitbull --skip-deploys `
    'DATABASE_URL=${{Postgres.DATABASE_URL}}' `
    "Jwt__Key=$jwtKey" `
    'Jwt__Issuer=pitbull-api' `
    'Jwt__Audience=pitbull-client' `
    'ASPNETCORE_ENVIRONMENT=Production' `
    'RAILWAY_DOCKERFILE_PATH=src/Pitbull.Api/Dockerfile' `
    "Cors__AllowedOrigins__0=$webUrl" `
    'Demo__Enabled=true' `
    'Demo__SeedOnStartup=true' `
    'Demo__DisableRegistration=true' `
    'Demo__TenantSlug=demo' `
    'Demo__TenantName=Pitbull Demo' `
    'Demo__UserEmail=demo@example.com' `
    "Demo__UserPassword=$demoPw" `
    'SeedData__AllowInNonDevelopment=true' 2>&1 | Out-Null

railway variables set -s pitbull --skip-deploys 'RAILWAY_HEALTHCHECK_PATH=/health/live' 2>&1 | Out-Null

railway variables set -s pitbull-web --skip-deploys `
    "NEXT_PUBLIC_API_BASE_URL=$apiUrl" `
    'RAILWAY_DOCKERFILE_PATH=src/Pitbull.Web/pitbull-web/Dockerfile' `
    'RAILWAY_HEALTHCHECK_PATH=/' 2>&1 | Out-Null

Write-Host "`n=== Done ===" -ForegroundColor Cyan
Write-Host "API:  $apiUrl"
Write-Host "Web:  $webUrl"
Write-Host "Demo: demo@example.com / $demoPw"
Write-Host ""
Write-Host "Deploy: git push origin main  (one deploy per commit - do NOT also run railway redeploy)" -ForegroundColor Yellow

if ($Redeploy) {
    Write-Host "Redeploying (manual, no --from-source)..." -ForegroundColor Yellow
    railway redeploy -s pitbull -y 2>&1 | Out-Null
    railway redeploy -s pitbull-web -y 2>&1 | Out-Null
}