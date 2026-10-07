[CmdletBinding()]
param(
    [switch]$DryRun
)

# Read-only environment doctor for verify-pitbull. It never starts or stops services.
$ErrorActionPreference = 'Stop'

function Emit-Check {
    param(
        [string]$Name,
        [bool]$Ok,
        [string]$Detail
    )
    $safeDetail = $Detail.Replace('"', '\"').Replace("`r", ' ').Replace("`n", ' ')
    Write-Output ('{"check":"' + $Name + '","ok":' + $Ok.ToString().ToLowerInvariant() + ',"detail":"' + $safeDetail + '"}')
}

if ($DryRun) {
    Emit-Check 'dry-run' $true 'Would check docker running, localhost:5432, http://localhost:5081/health/live, http://localhost:3000, and (informational) /api/version; no processes or containers would be started or stopped.'
    exit 0
}

$allOk = $true

try {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Emit-Check 'docker' $false 'docker command is not available'
        $allOk = $false
    } else {
        $dockerOutput = (& docker info 2>&1 | Out-String).Trim()
        if ($LASTEXITCODE -ne 0) {
            Emit-Check 'docker' $false ('Docker is not responding: ' + $dockerOutput)
            $allOk = $false
        } else {
            Emit-Check 'docker' $true 'Docker is responding'
        }
    }
} catch {
    Emit-Check 'docker' $false $_.Exception.Message
    $allOk = $false
}

try {
    $port = Test-NetConnection -ComputerName localhost -Port 5432 -InformationLevel Quiet -WarningAction SilentlyContinue
    Emit-Check 'postgres-5432' ([bool]$port) ($(if ($port) { 'localhost:5432 is reachable' } else { 'localhost:5432 is not reachable' }))
    if (-not $port) { $allOk = $false }
} catch {
    Emit-Check 'postgres-5432' $false $_.Exception.Message
    $allOk = $false
}

try {
    $health = Invoke-WebRequest -Uri 'http://localhost:5081/health/live' -UseBasicParsing -TimeoutSec 5
    $ok = ($health.StatusCode -ge 200 -and $health.StatusCode -lt 300)
    Emit-Check 'api-health-5081' $ok ('http://localhost:5081/health/live returned ' + $health.StatusCode)
    if (-not $ok) { $allOk = $false }
} catch {
    Emit-Check 'api-health-5081' $false $_.Exception.Message
    $allOk = $false
}

try {
    $web = Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 5
    $ok = ($web.StatusCode -ge 200 -and $web.StatusCode -lt 400)
    Emit-Check 'web-3000' $ok ('http://localhost:3000 returned ' + $web.StatusCode)
    if (-not $ok) { $allOk = $false }
} catch {
    Emit-Check 'web-3000' $false $_.Exception.Message
    $allOk = $false
}

# Informational only: which build is the API on 5081? (never fails the doctor)
try {
    $ver = Invoke-WebRequest -Uri 'http://localhost:5081/api/version' -UseBasicParsing -TimeoutSec 5
    Emit-Check 'api-version-info' $true ('http://localhost:5081/api/version -> ' + $ver.Content)
} catch {
    Emit-Check 'api-version-info' $true ('version unavailable: ' + $_.Exception.Message)
}

if (-not $allOk) { exit 1 }
exit 0
