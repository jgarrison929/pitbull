#Requires -Version 5.1
<#
.SYNOPSIS
  Local pre-ship checks that catch the failures we keep re-learning in CI.

.DESCRIPTION
  Fast gates before open/push PR (maps to CI + CONTRIBUTING version checklist):
    1) Version stamp consistency
    2) Frontend unit tests (vitest)
    3) Frontend eslint on changed pitbull-web files (or full lint)
    4) Optional: full web lint + next build (-FullWeb)
    5) Optional: .NET unit tests (-DotNet)

  Exit 0 only if all selected gates pass.

.EXAMPLE
  ./scripts/preflight.ps1
  ./scripts/preflight.ps1 -FullWeb
  ./scripts/preflight.ps1 -DotNet
#>
param(
  [switch]$FullWeb,
  [switch]$DotNet,
  [switch]$SkipTests,
  [switch]$SkipVersion
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $RepoRoot

$failed = [System.Collections.Generic.List[string]]::new()
$passed = [System.Collections.Generic.List[string]]::new()

function Write-Step([string]$msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

function Ok([string]$msg) {
  [void]$passed.Add($msg)
  Write-Host "  OK  $msg" -ForegroundColor Green
}

function Fail([string]$msg) {
  [void]$failed.Add($msg)
  Write-Host "  FAIL  $msg" -ForegroundColor Red
}

function Assert-FileContains([string]$relPath, [string]$needle, [string]$label) {
  $full = Join-Path $RepoRoot $relPath
  if (-not (Test-Path $full)) {
    Fail "Missing $relPath"
    return
  }
  # Use IndexOf (not -like): brackets in ## [2.8.1] are wildcards for -like
  $content = Get-Content $full -Raw
  if ($content.IndexOf($needle, [System.StringComparison]::Ordinal) -lt 0) {
    Fail "$label - expected '$needle' in $relPath"
  } else {
    Ok $label
  }
}

# -- 1. Version stamps ---------------------------------------------
if (-not $SkipVersion) {
  Write-Step "Version stamp consistency (CONTRIBUTING)"

  $versionFile = Join-Path $RepoRoot "VERSION"
  if (-not (Test-Path $versionFile)) {
    Fail "VERSION file missing"
  } else {
    $v = (Get-Content $versionFile -Raw).Trim()
    if ($v -notmatch '^\d+\.\d+\.\d+$') {
      Fail "VERSION not X.Y.Z: '$v'"
    } else {
      Ok "VERSION = $v"
      Assert-FileContains "v5/package.json" "`"version`": `"$v`"" "v5/package.json"
      # Guard: never full-string Replace product VERSION through package-lock (corrupts dependency versions).
      $lockPath = Join-Path $RepoRoot "v5/package-lock.json"
      $lockText = Get-Content $lockPath -Raw
      if ($lockText -match 'is-core-module/-/is-core-module-2\.1[7-9]\.') {
        Fail "v5/package-lock.json has corrupted is-core-module (product VERSION replace leaked into deps). Never global-replace VERSION in package-lock."
      } else {
        Ok "v5 package-lock is-core-module not product-VERSION-corrupted"
      }
    }
  }
}

# -- 2. Frontend tests ---------------------------------------------
$web = Join-Path $RepoRoot "v5"
if (-not $SkipTests) {
  Write-Step "Frontend unit tests (vitest)"
  Push-Location $web
  try {
    npx vitest run --passWithNoTests
    if ($LASTEXITCODE -ne 0) { Fail "vitest" } else { Ok "vitest" }
  } finally {
    Pop-Location
  }
}

# -- 3. Lint -------------------------------------------------------
Write-Step "Frontend eslint"
Push-Location $web
try {
  if ($FullWeb) {
    npm run lint
    if ($LASTEXITCODE -ne 0) { Fail "eslint (full)" } else { Ok "eslint (full)" }
  } else {
    $rawDiff = @()
    try {
      $rawDiff = @(git -C $RepoRoot diff --name-only "origin/main...HEAD" 2>$null)
    } catch { }
    if ($rawDiff.Count -eq 0) {
      try { $rawDiff = @(git -C $RepoRoot diff --name-only HEAD 2>$null) } catch { }
    }
    if ($rawDiff.Count -eq 0) {
      try { $rawDiff = @(git -C $RepoRoot diff --name-only --cached 2>$null) } catch { }
    }

    $changed = @(
      $rawDiff |
        Where-Object { $_ -match '^v5/.*\.(ts|tsx|js|jsx|mjs)$' } |
        ForEach-Object { $_ -replace '^v5/', '' } |
        Where-Object { Test-Path (Join-Path $web $_) }
    )

    if ($changed.Count -eq 0) {
      Write-Host "  (no changed web source vs main - full lint)" -ForegroundColor DarkYellow
      npm run lint
      if ($LASTEXITCODE -ne 0) { Fail "eslint (full)" } else { Ok "eslint (full)" }
    } else {
      Write-Host "  linting $($changed.Count) changed file(s)"
      & npx eslint @($changed)
      if ($LASTEXITCODE -ne 0) { Fail "eslint (changed)" } else { Ok "eslint (changed) $($changed.Count) files" }
    }
  }
} finally {
  Pop-Location
}

# -- 4. Optional full web build ------------------------------------
if ($FullWeb) {
  Write-Step "Next.js build"
  Push-Location $web
  try {
    npm run build
    if ($LASTEXITCODE -ne 0) { Fail "next build" } else { Ok "next build" }
  } finally {
    Pop-Location
  }
}

# -- 5. Optional .NET unit tests -----------------------------------
if ($DotNet) {
  Write-Step ".NET unit tests"
  Fail "Legacy .NET tests were removed with the 3.8.2 tree (tag legacy-3.8.2-final)."
}

# -- Summary -------------------------------------------------------
Write-Host ""
Write-Host "======== preflight summary ========" -ForegroundColor White
foreach ($p in $passed) { Write-Host "  PASS  $p" -ForegroundColor Green }
foreach ($f in $failed) { Write-Host "  FAIL  $f" -ForegroundColor Red }
Write-Host "===================================" -ForegroundColor White

if ($failed.Count -gt 0) {
  Write-Host "Preflight FAILED ($($failed.Count)). Fix before push/PR." -ForegroundColor Red
  exit 1
}

Write-Host "Preflight OK - safe to push / open PR." -ForegroundColor Green
exit 0
