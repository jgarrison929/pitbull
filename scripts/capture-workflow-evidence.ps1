param(
    [string]$ScratchDir = "$env:TEMP\grok-goal-evidence",
    [switch]$SkipPlaywright,
    [string]$ApiUrl = "http://localhost:5081",
    [string]$WebUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
New-Item -ItemType Directory -Force -Path $ScratchDir | Out-Null

$unitLog = Join-Path $ScratchDir "unit-workflow-evidence.log"
$integrationLog = Join-Path $ScratchDir "integration-workflow-evidence.log"
$l2Log = Join-Path $ScratchDir "l2-browser-create-activate.log"
$payrollLog = Join-Path $ScratchDir "payroll-e2e.log"
$l4Log = Join-Path $ScratchDir "l4-billing-paid.log"
$l6Log = Join-Path $ScratchDir "l6-owner-co.log"
$l9Log = Join-Path $ScratchDir "l9-vendor-accrual.log"

function Assert-LogEvidence {
    param(
        [string]$Path,
        [string[]]$RequiredMarkers,
        [int]$MinBytes = 512
    )
    if (-not (Test-Path $Path)) {
        throw "Missing evidence log: $Path"
    }
    $bytes = (Get-Item $Path).Length
    if ($bytes -lt $MinBytes) {
        throw "Evidence log too small ($bytes B, need >= $MinBytes): $Path"
    }
    $text = Get-Content -Path $Path -Raw -Encoding UTF8
    foreach ($marker in $RequiredMarkers) {
        if ($text -notmatch [regex]::Escape($marker)) {
            throw "Evidence log missing marker '$marker': $Path"
        }
    }
}

Push-Location $repoRoot
try {
    Write-Host "=== Step 1/7: unit workflow evidence ==="
    dotnet test tests/Pitbull.Tests.Unit `
        --configuration Release `
        --no-build:$false `
        --filter "FullyQualifiedName~CompanyOvertimePolicyTests|FullyQualifiedName~ProjectTeamAssignmentServiceTests|FullyQualifiedName~CreateProjectAsync_WithTeamMembers_PersistsProjectAssignments|FullyQualifiedName~CreateProjectAsync_WithAutoCreatePhases_CreatesDefaultPhases|FullyQualifiedName~GeneratePayrollRun_UsesReportSettingsCaliforniaDailyThreshold|FullyQualifiedName~Update_PendingToApproved_PostsAccrualAndSetsJournalEntryId" `
        --logger "console;verbosity=normal" `
        2>&1 | Tee-Object -FilePath $unitLog
    if ($LASTEXITCODE -ne 0) { throw "Unit workflow evidence tests failed (exit $LASTEXITCODE)" }

    Write-Host "=== Step 2/7: integration WorkflowGapEvidenceTests ==="
    dotnet test tests/Pitbull.Tests.Integration `
        --configuration Release `
        --filter "FullyQualifiedName~WorkflowGapEvidenceTests" `
        --logger "console;verbosity=detailed" `
        2>&1 | Tee-Object -FilePath $integrationLog
    if ($LASTEXITCODE -ne 0) { throw "Integration workflow evidence tests failed (exit $LASTEXITCODE)" }

    Assert-LogEvidence -Path $integrationLog -RequiredMarkers @(
        "L2_EVIDENCE", "L3_EVIDENCE", "L3_PAYROLL_EVIDENCE",
        "L4_EVIDENCE", "L6_EVIDENCE", "L9_EVIDENCE"
    ) -MinBytes 1024

    if (-not $SkipPlaywright) {
        Write-Host "=== Step 3/7: Playwright setup-roles ==="
        foreach ($url in @("$ApiUrl/health/live", $WebUrl)) {
            try {
                $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
                Write-Host "Health OK: $url ($($r.StatusCode))"
            } catch {
                throw "Stack not running at $url - start API (Development + Demo__Enabled) and frontend, or pass -SkipPlaywright"
            }
        }

        $env:DEMO_BASE_URL = $WebUrl
        $env:API_BASE_URL = $ApiUrl
        $env:E2E_RUN_TAG = "evidence-$(Get-Date -Format 'yyyyMMddHHmmss')"
        $nodeExe = (Get-Command node -ErrorAction Stop).Source
        function Invoke-PlaywrightStep {
            param(
                [string[]]$PlaywrightArgs,
                [string]$LogPath,
                [string]$Label
            )
            $argLine = ($PlaywrightArgs | ForEach-Object {
                if ($_ -match '\s') { '"' + ($_ -replace '"', '\"') + '"' } else { $_ }
            }) -join ' '
            $proc = Start-Process `
                -FilePath $nodeExe `
                -ArgumentList $argLine `
                -WorkingDirectory (Get-Location).Path `
                -NoNewWindow `
                -Wait `
                -PassThru `
                -RedirectStandardOutput $LogPath `
                -RedirectStandardError "${LogPath}.err"
            $text = Get-Content -Path $LogPath -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
            if (Test-Path "${LogPath}.err") {
                $errText = Get-Content -Path "${LogPath}.err" -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
                if ($errText) {
                    Add-Content -Path $LogPath -Value $errText -Encoding UTF8
                    $text = Get-Content -Path $LogPath -Raw -Encoding UTF8
                }
            }
            if ([string]::IsNullOrWhiteSpace($text)) {
                throw "Playwright $Label produced no output (exit $($proc.ExitCode), see $LogPath)"
            }
            if ($text -notmatch '\d+ passed') {
                throw "Playwright $Label produced no passing tests (exit $($proc.ExitCode), see $LogPath)"
            }
            if ($text -match '(\d+) failed' -and [int]$Matches[1] -gt 0) {
                throw "Playwright $Label failed (exit $($proc.ExitCode), see $LogPath)"
            }
        }

        Push-Location (Join-Path $repoRoot "e2e")
        try {
            $setupLog = Join-Path $ScratchDir "playwright-setup-roles.log"
            Invoke-PlaywrightStep `
                -PlaywrightArgs @("node_modules/@playwright/test/cli.js", "test", "--project=setup-roles") `
                -LogPath $setupLog `
                -Label "setup-roles"

            Write-Host "=== Step 4/7: Playwright L2 browser create/activate ==="
            Invoke-PlaywrightStep `
                -PlaywrightArgs @(
                    "node_modules/@playwright/test/cli.js", "test", "tests/role-workflows.spec.ts",
                    "--project=role-workflows", "-g", "L2 Project setup", "--reporter=line"
                ) `
                -LogPath $l2Log `
                -Label "L2 browser create/activate"

            Write-Host "=== Step 5/7: Playwright L3b payroll ==="
            Invoke-PlaywrightStep `
                -PlaywrightArgs @(
                    "node_modules/@playwright/test/cli.js", "test", "tests/role-workflows.spec.ts",
                    "--project=role-workflows", "-g", "L3b Payroll", "--reporter=line"
                ) `
                -LogPath $payrollLog `
                -Label "L3b payroll"

            Write-Host "=== Step 6/7: Playwright L4 owner billing Paid ==="
            Invoke-PlaywrightStep `
                -PlaywrightArgs @(
                    "node_modules/@playwright/test/cli.js", "test", "tests/role-workflows.spec.ts",
                    "--project=role-workflows", "-g", "L4 Owner billing", "--reporter=line"
                ) `
                -LogPath $l4Log `
                -Label "L4 billing Paid"

            Write-Host "=== Step 7/7: Playwright L6b owner CO + L9 vendor accrual ==="
            Invoke-PlaywrightStep `
                -PlaywrightArgs @(
                    "node_modules/@playwright/test/cli.js", "test", "tests/role-workflows.spec.ts",
                    "--project=role-workflows", "-g", "L6b Owner change order|L9 Vendor invoice", "--reporter=line"
                ) `
                -LogPath $l6Log `
                -Label "L6b owner CO"

            # L9 shares the combined run log above; copy for separate artifact gate
            Copy-Item -Path $l6Log -Destination $l9Log -Force
        } finally {
            Pop-Location
        }

        Assert-LogEvidence -Path $l2Log -RequiredMarkers @("L2_EVIDENCE") -MinBytes 1024
        Assert-LogEvidence -Path $payrollLog -RequiredMarkers @("L3_EVIDENCE") -MinBytes 1024
        Assert-LogEvidence -Path $l4Log -RequiredMarkers @("L4_EVIDENCE", "Paid") -MinBytes 1024
        Assert-LogEvidence -Path $l6Log -RequiredMarkers @("L6_EVIDENCE") -MinBytes 1024
        Assert-LogEvidence -Path $l9Log -RequiredMarkers @("L9_EVIDENCE") -MinBytes 1024
    } else {
        Write-Host "Skipping Playwright steps (-SkipPlaywright)"
    }

    Write-Host "=== Evidence capture PASSED ==="
    Write-Host "Artifacts under $ScratchDir"
}
finally {
    Pop-Location
}