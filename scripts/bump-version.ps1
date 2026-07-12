#Requires -Version 5.1
<#
.SYNOPSIS
  Safe product version stamp bump (one X.Y.Z → next).

.DESCRIPTION
  Updates VERSION, package.json, API csproj, Docker ARGs, docker-compose, app-version.ts.
  package-lock.json: ONLY the root package "name"/"version" fields for pitbull-web —
  never a global Replace of the version string (that corrupts nested npm deps).

.EXAMPLE
  ./scripts/bump-version.ps1 -From 2.17.6 -To 2.17.7
#>
param(
  [Parameter(Mandatory = $true)][string]$From,
  [Parameter(Mandatory = $true)][string]$To
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

if ($From -notmatch '^\d+\.\d+\.\d+$' -or $To -notmatch '^\d+\.\d+\.\d+$') {
  throw "From/To must be X.Y.Z"
}

function Replace-FileExact([string]$rel, [string]$old, [string]$new) {
  $p = Join-Path $RepoRoot $rel
  if (-not (Test-Path $p)) { throw "Missing $rel" }
  $c = [System.IO.File]::ReadAllText($p)
  if (-not $c.Contains($old)) { Write-Host "WARN no match in $rel for '$old'"; return }
  [System.IO.File]::WriteAllText($p, $c.Replace($old, $new))
  Write-Host "OK $rel"
}

# Root VERSION (entire file content)
$vf = Join-Path $RepoRoot "VERSION"
[System.IO.File]::WriteAllText($vf, "$To`n")
Write-Host "OK VERSION"

# package.json root version only
$pkgPath = Join-Path $RepoRoot "src/Pitbull.Web/pitbull-web/package.json"
$pkg = [System.IO.File]::ReadAllText($pkgPath)
$pkg2 = $pkg -replace "`"version`": `"$([regex]::Escape($From))`"", "`"version`": `"$To`""
if ($pkg -eq $pkg2) { throw "package.json version not updated" }
[System.IO.File]::WriteAllText($pkgPath, $pkg2)
Write-Host "OK package.json"

# package-lock: only root package version (lines 1–15 style), not global replace
$lockPath = Join-Path $RepoRoot "src/Pitbull.Web/pitbull-web/package-lock.json"
$lock = [System.IO.File]::ReadAllText($lockPath)
# First two "version": "X.Y.Z" near root for name pitbull-web
$rx = [regex]'(?m)^(\s*"version":\s*")' + [regex]::Escape($From) + '(")'
# Limit to first 2 replacements only (root + packages[""])
$n = 0
$lock2 = $rx.Replace($lock, {
  param($m)
  $script:n++
  if ($script:n -le 2) { return $m.Groups[1].Value + $To + $m.Groups[2].Value }
  return $m.Value
})
if ($n -lt 1) { throw "package-lock root version not found for $From" }
[System.IO.File]::WriteAllText($lockPath, $lock2)
Write-Host "OK package-lock.json (root only, $n root-ish replacements)"

Replace-FileExact "src/Pitbull.Api/Pitbull.Api.csproj" "<Version>$From</Version>" "<Version>$To</Version>"
Replace-FileExact "src/Pitbull.Api/Pitbull.Api.csproj" "<AssemblyVersion>$From.0</AssemblyVersion>" "<AssemblyVersion>$To.0</AssemblyVersion>"
Replace-FileExact "src/Pitbull.Api/Pitbull.Api.csproj" "<FileVersion>$From.0</FileVersion>" "<FileVersion>$To.0</FileVersion>"
Replace-FileExact "src/Pitbull.Api/Pitbull.Api.csproj" "<InformationalVersion>$From</InformationalVersion>" "<InformationalVersion>$To</InformationalVersion>"
Replace-FileExact "src/Pitbull.Api/Dockerfile" "ARG VERSION=$From" "ARG VERSION=$To"
Replace-FileExact "src/Pitbull.Web/pitbull-web/Dockerfile" "ARG NEXT_PUBLIC_APP_VERSION=$From" "ARG NEXT_PUBLIC_APP_VERSION=$To"
Replace-FileExact "docker-compose.prod.yml" "APP_VERSION:-$From" "APP_VERSION:-$To"
Replace-FileExact "src/Pitbull.Web/pitbull-web/src/lib/app-version.ts" "return `"$From`"" "return `"$To`""

Write-Host "Done $From → $To. Add CHANGELOG header; run preflight before push."
