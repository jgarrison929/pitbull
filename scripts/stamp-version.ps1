# Stamp product version surfaces (CONTRIBUTING / preflight). Never global-replace package-lock.
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
Replace-InFile "src\Pitbull.Web\pitbull-web\package.json" "`"version`": `"$From`"" "`"version`": `"$To`""
# package-lock root only (lines 3 and packages[""])
$lockPath = "src\Pitbull.Web\pitbull-web\package-lock.json"
$lock = Get-Content $lockPath
if ($lock[2] -match [regex]::Escape("`"version`": `"$From`"")) {
  $lock[2] = $lock[2] -replace [regex]::Escape($From), $To
}
if ($lock[8] -match [regex]::Escape("`"version`": `"$From`"")) {
  $lock[8] = $lock[8] -replace [regex]::Escape($From), $To
}
$lock | Set-Content $lockPath
Replace-InFile "src\Pitbull.Web\pitbull-web\src\lib\app-version.ts" "return `"$From`"" "return `"$To`""
Replace-InFile "src\Pitbull.Api\Pitbull.Api.csproj" "<Version>$From</Version>" "<Version>$To</Version>"
Replace-InFile "src\Pitbull.Api\Pitbull.Api.csproj" "<AssemblyVersion>$From.0</AssemblyVersion>" "<AssemblyVersion>$To.0</AssemblyVersion>"
Replace-InFile "src\Pitbull.Api\Pitbull.Api.csproj" "<FileVersion>$From.0</FileVersion>" "<FileVersion>$To.0</FileVersion>"
Replace-InFile "src\Pitbull.Api\Pitbull.Api.csproj" "<InformationalVersion>$From</InformationalVersion>" "<InformationalVersion>$To</InformationalVersion>"
# Docker: replace ARG defaults carefully
(Get-Content "src\Pitbull.Api\Dockerfile" -Raw) -replace "ARG VERSION=$From", "ARG VERSION=$To" | Set-Content "src\Pitbull.Api\Dockerfile" -NoNewline
(Get-Content "src\Pitbull.Web\pitbull-web\Dockerfile" -Raw) -replace "ARG NEXT_PUBLIC_APP_VERSION=$From", "ARG NEXT_PUBLIC_APP_VERSION=$To" | Set-Content "src\Pitbull.Web\pitbull-web\Dockerfile" -NoNewline
(Get-Content "docker-compose.prod.yml" -Raw) -replace "APP_VERSION:-$From", "APP_VERSION:-$To" | Set-Content "docker-compose.prod.yml" -NoNewline
Write-Output "Stamped $From -> $To"
Get-Content VERSION
