# Orchestrates role-based E2E: stack check, API role smoke, Playwright role workflows.
# Usage: .\scripts\run-role-e2e.ps1 [-ScratchDir <path>] [-SkipPlaywright]
param(
    [string]$ScratchDir = "$env:LOCALAPPDATA\Temp\grok-goal-7bd6e34ca9b6\implementer",
    [switch]$SkipPlaywright,
    [string]$ApiUrl = "http://localhost:5081",
    [string]$WebUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
$roleE2eDir = Join-Path $ScratchDir "role-e2e"
New-Item -ItemType Directory -Force -Path $roleE2eDir | Out-Null

function Write-Log([string]$msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
    Write-Host $line
    Add-Content -Path (Join-Path $ScratchDir "role-e2e-orchestrator.log") -Value $line -Encoding utf8
}

Write-Log "=== Role E2E orchestrator ==="
Write-Log "Scratch: $ScratchDir"

# Health checks
foreach ($url in @("$ApiUrl/health/live", $WebUrl)) {
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
        Write-Log "PASS health $url -> $($r.StatusCode)"
    } catch {
        Write-Log "FAIL health $url - start API (Development + Demo__Enabled) and frontend first"
        throw
    }
}

# Role API smoke — 3 personas x 2 runs
$profiles = @("PM", "AR", "AP")
$smokeLog = Join-Path $ScratchDir "role-smoke.log"
if (Test-Path $smokeLog) { Remove-Item $smokeLog -Force }
foreach ($run in 1..2) {
    foreach ($profile in $profiles) {
        Write-Log "Role smoke run $run profile $profile"
        & "$PSScriptRoot\workflow-api-smoke.ps1" `
            -BaseUrl $ApiUrl `
            -RunNumber $run `
            -RoleProfile $profile `
            -UseDemoUsers `
            -LogFile $smokeLog
    }
}
Write-Log "Role smoke complete -> $smokeLog"

if (-not $SkipPlaywright) {
    $env:DEMO_BASE_URL = $WebUrl
    $env:API_BASE_URL = $ApiUrl
    $env:E2E_OUTPUT_DIR = $roleE2eDir
    Push-Location (Join-Path $PSScriptRoot "..\e2e")
    try {
        foreach ($run in 1..2) {
            Write-Log "Playwright role-workflows run $run"
            $outFile = Join-Path $roleE2eDir "playwright-run-$run.log"
            npx playwright test --project=role-workflows 2>&1 | Tee-Object -FilePath $outFile
            if ($LASTEXITCODE -ne 0) {
                Write-Log "Playwright run $run exit code $LASTEXITCODE (see $outFile)"
            } else {
                Write-Log "Playwright run $run PASS"
            }
        }
    } finally {
        Pop-Location
    }
}

Write-Log "=== Orchestrator finished ==="