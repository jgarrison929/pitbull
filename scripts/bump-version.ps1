param(
  [Parameter(Mandatory=$true)][string]$From,
  [Parameter(Mandatory=$true)][string]$To
)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot/..
function Replace-InFile($path, $old, $new) {
  if (-not (Test-Path $path)) { throw "missing $path" }
  $c = [IO.File]::ReadAllText((Resolve-Path $path))
  if (-not $c.Contains($old)) { Write-Warning "pattern not found in $path : $old" }
  $c2 = $c.Replace($old, $new)
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [IO.File]::WriteAllText((Resolve-Path $path), $c2, $utf8)
}
# root VERSION + v5 package stamps. The 3.8.2 tree is gone (tag legacy-3.8.2-final).
[IO.File]::WriteAllText((Resolve-Path "VERSION"), "$To`n", (New-Object System.Text.UTF8Encoding $false))
Replace-InFile "v5/package.json" "`"version`": `"$From`"" "`"version`": `"$To`""
Write-Host "Bumped $From -> $To"

# package-lock product version only (root metadata and packages[""], both named pcs-v5)
$lock = "v5/package-lock.json"
if (Test-Path $lock) {
  $lc = [IO.File]::ReadAllText((Resolve-Path $lock))
  $pattern = '("name": "pcs-v5",\r?\n\s*"version": ")' + [regex]::Escape($From) + '(")'
  $lc2 = [regex]::Replace($lc, $pattern, '${1}' + $To + '${2}')
  if ($lc2 -eq $lc) { Write-Warning "pcs-v5 version $From not found in $lock" }
  [IO.File]::WriteAllText((Resolve-Path $lock), $lc2)
}
