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
      Assert-FileContains "src/Pitbull.Web/pitbull-web/package.json" "`"version`": `"$v`"" "package.json"
      Assert-FileContains "src/Pitbull.Web/pitbull-web/package-lock.json" "`"version`": `"$v`"" "package-lock.json (root)"
      # Guard: never full-string Replace product VERSION through package-lock (corrupts deps like is-core-module).
      $lockPath = Join-Path $RepoRoot "src/Pitbull.Web/pitbull-web/package-lock.json"
      $lockText = Get-Content $lockPath -Raw
      # Real is-core-module tops out at 2.16.x on npm — 2.17+ means VERSION stamp leaked into lockfile.
      if ($lockText -match 'is-core-module/-/is-core-module-2\.1[7-9]\.') {
        Fail "package-lock.json has corrupted is-core-module (product VERSION replace leaked into deps). Fix to real npm version (e.g. 2.16.2); never global-replace VERSION in package-lock."
      } else {
        Ok "package-lock is-core-module not product-VERSION-corrupted"
      }
      Assert-FileContains "src/Pitbull.Api/Pitbull.Api.csproj" "<Version>$v</Version>" "API csproj Version"
      Assert-FileContains "src/Pitbull.Api/Pitbull.Api.csproj" "<AssemblyVersion>$v.0</AssemblyVersion>" "API AssemblyVersion"
      Assert-FileContains "src/Pitbull.Api/Pitbull.Api.csproj" "<FileVersion>$v.0</FileVersion>" "API FileVersion"
      Assert-FileContains "src/Pitbull.Api/Pitbull.Api.csproj" "<InformationalVersion>$v</InformationalVersion>" "API InformationalVersion"
      Assert-FileContains "src/Pitbull.Api/Dockerfile" "ARG VERSION=$v" "API Dockerfile ARG"
      Assert-FileContains "src/Pitbull.Web/pitbull-web/Dockerfile" "ARG NEXT_PUBLIC_APP_VERSION=$v" "Web Dockerfile ARG"
      Assert-FileContains "docker-compose.prod.yml" "APP_VERSION:-$v" "docker-compose.prod.yml"
      Assert-FileContains "src/Pitbull.Web/pitbull-web/src/lib/app-version.ts" "return `"$v`"" "app-version.ts fallback"
      Assert-FileContains "CHANGELOG.md" "## [$v]" "CHANGELOG header"
    }
  }
}

# -- 2. Frontend tests ---------------------------------------------
$web = Join-Path $RepoRoot "src/Pitbull.Web/pitbull-web"
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
        Where-Object { $_ -match 'Pitbull\.Web/pitbull-web/src/.*\.(ts|tsx|js|jsx|mjs)$' } |
        ForEach-Object { $_ -replace '^src/Pitbull\.Web/pitbull-web/', '' } |
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
  $unitProj = Join-Path $RepoRoot "tests/Pitbull.Tests.Unit/Pitbull.Tests.Unit.csproj"
  if (-not (Test-Path $unitProj)) {
    Fail "missing $unitProj"
  } else {
    dotnet test $unitProj --verbosity minimal
    if ($LASTEXITCODE -ne 0) { Fail "dotnet unit tests" } else { Ok "dotnet unit tests" }
  }
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
