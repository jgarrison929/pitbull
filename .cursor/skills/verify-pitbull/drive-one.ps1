[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$SkipDoctor,
    [switch]$SkipPlaywright,
    [ValidateSet('all','login-explore-as-role','projects-workspace','time-tracking','contracts-aia-billing','daily-reports-field','payroll-runs-union-certified')]
    [string]$Feature = 'all',
    [string]$Prefix = 'verify',
    [string]$Ts = (Get-Date -Format 'yyyyMMdd-HHmmss'),
    # Opt-in to the repository role runner. It is NOT read-only: workflow-api-smoke.ps1 registers users and creates
    # employees, bids, projects, subcontracts, pay-period config; role-workflows.spec.ts creates/approves bids, time,
    # payroll runs, billing apps, change orders, RFIs, daily reports. Requires -AllowMutation.
    [switch]$RoleE2E,
    [switch]$AllowMutation,
    [string]$ScratchDir,
    [string]$ApiUrl = "http://localhost:5081",
    [string]$WebUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
$repo = "C:\pitbull-private"
$skill = Join-Path $repo ".cursor\skills\verify-pitbull"
$doctor = Join-Path $skill "doctor.ps1"
$apiSmoke = Join-Path $skill "live-api-smoke.ps1"
$webSmoke = Join-Path $skill "live-web-smoke.cjs"
$runner = Join-Path $repo "scripts\run-role-e2e.ps1"

if ($RoleE2E -and -not $AllowMutation) {
    Write-Error '{"error":"-RoleE2E runs scripts\\run-role-e2e.ps1, which mutates the shared demo database; pass -AllowMutation only when the run owns that data"}'
    exit 2
}

if ($DryRun) {
    $mode = $(if ($RoleE2E) { 'role-e2e (mutating)' } else { 'read-only live-api-smoke + live-web-smoke' })
    Write-Output ('{"dryRun":true,"mode":"' + $mode + '","feature":"' + $Feature + '","SkipPlaywright":' + $SkipPlaywright.IsPresent.ToString().ToLower() + ',"wouldStartOrStop":false}')
    exit 0
}

if (-not $SkipDoctor) {
    & $doctor
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if ($RoleE2E) {
    if (-not (Test-Path -LiteralPath $runner)) {
        Write-Error '{"error":"Repository runner not found at C:\\pitbull-private\\scripts\\run-role-e2e.ps1"}'
        exit 2
    }
    $splat = @{ ApiUrl = $ApiUrl; WebUrl = $WebUrl }
    if ($ScratchDir) { $splat.ScratchDir = $ScratchDir }
    if ($SkipPlaywright) { $splat.SkipPlaywright = $true }
    Push-Location $repo
    try { & $runner @splat; exit $LASTEXITCODE } finally { Pop-Location }
}

# Default: read-only smoke. Evidence: evidence\<Prefix>-<Ts>-<feature>-*.{json,txt,png}
& $apiSmoke -Ts $Ts -Prefix $Prefix -ApiUrl $ApiUrl -Feature $Feature
if (-not $SkipPlaywright) {
    $billingJson = Join-Path $skill "evidence\$Prefix-$Ts-contracts-aia-billing-applications.json"
    Push-Location (Join-Path $repo "e2e")
    try {
        $env:WEB_URL = $WebUrl
        if ($Feature -ne 'all') { $env:FEATURE = $Feature } else { Remove-Item Env:FEATURE -ErrorAction SilentlyContinue }
        & node $webSmoke $Prefix $Ts $billingJson
        $code = $LASTEXITCODE
    } finally {
        Remove-Item Env:FEATURE -ErrorAction SilentlyContinue
        Pop-Location
    }
    exit $code
}
exit 0