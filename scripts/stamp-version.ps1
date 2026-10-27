# Stamp product version surfaces. Never global-replace package-lock.
# Live stamps: root VERSION, v5/package.json, v5/package-lock.json (pcs-v5 blocks only).
param(
  [Parameter(Mandatory = $true)][string]$From,
  [Parameter(Mandatory = $true)][string]$To
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Replace-InFile($path, $old, $new) {
  if (-not (Test-Path $path)) { throw "Missing $path" }
  $text = Get-Content $path -Raw
  if ($text -notlike "*$old*") { Write-Warning "No '$old' in $path (may already be stamped)" }
  $text2 = $text.Replace($old, $new)
  Set-Content -Path $path -Value $text2 -NoNewline
}

Set-Content -Path (Join-Path $root "VERSION") -Value $To -NoNewline
Replace-InFile "v5/package.json" "`"version`": `"$From`"" "`"version`": `"$To`""

$lockPath = "v5/package-lock.json"
$lock = [IO.File]::ReadAllText((Resolve-Path $lockPath))
$pattern = '("name": "pcs-v5",\r?\n\s*"version": ")' + [regex]::Escape($From) + '(")'
$lock2 = [regex]::Replace($lock, $pattern, '${1}' + $To + '${2}')
if ($lock2 -eq $lock) { Write-Warning "pcs-v5 version $From not found in $lockPath" }
[IO.File]::WriteAllText((Resolve-Path $lockPath), $lock2)
Write-Output "Stamped $From -> $To"
Get-Content VERSION
