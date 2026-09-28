[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$SkipDoctor,
    [switch]$SkipPlaywright,
    [string]$ScratchDir,
    [string]$ApiUrl = "http://localhost:5081",
    [string]$WebUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
$repo = "C:\pitbull-private"
$skill = Join-Path $repo ".cursor\skills\verify-pitbull"
$doctor = Join-Path $skill "doctor.ps1"
$runner = Join-Path $repo "scripts\run-role-e2e.ps1"

if (-not (Test-Path -LiteralPath $runner)) {
    Write-Error '{"error":"Repository runner not found at C:\\pitbull-private\\scripts\\run-role-e2e.ps1"}'
    exit 2
}

if ($DryRun) {
    Write-Output ('{"dryRun":true,"would":"run scripts\\run-role-e2e.ps1","SkipPlaywright":' + $SkipPlaywright.IsPresent.ToString().ToLower() + ',"wouldStartOrStop":false}')
    exit 0
}

if (-not $SkipDoctor) {
    & $doctor
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$splat = @{ ApiUrl = $ApiUrl; WebUrl = $WebUrl }
if ($ScratchDir) { $splat.ScratchDir = $ScratchDir }
if ($SkipPlaywright) { $splat.SkipPlaywright = $true }

Push-Location $repo
try {
    & $runner @splat
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
