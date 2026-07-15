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
# root VERSION
[IO.File]::WriteAllText((Resolve-Path "VERSION"), "$To`n", (New-Object System.Text.UTF8Encoding $false))
Replace-InFile "src/Pitbull.Web/pitbull-web/package.json" "`"version`": `"$From`"" "`"version`": `"$To`""
Replace-InFile "src/Pitbull.Api/Pitbull.Api.csproj" "<Version>$From</Version>" "<Version>$To</Version>"
Replace-InFile "src/Pitbull.Api/Pitbull.Api.csproj" "<AssemblyVersion>$From.0</AssemblyVersion>" "<AssemblyVersion>$To.0</AssemblyVersion>"
Replace-InFile "src/Pitbull.Api/Pitbull.Api.csproj" "<FileVersion>$From.0</FileVersion>" "<FileVersion>$To.0</FileVersion>"
Replace-InFile "src/Pitbull.Api/Pitbull.Api.csproj" "<InformationalVersion>$From</InformationalVersion>" "<InformationalVersion>$To</InformationalVersion>"
Replace-InFile "src/Pitbull.Api/Dockerfile" "ARG VERSION=$From" "ARG VERSION=$To"
Replace-InFile "src/Pitbull.Web/pitbull-web/Dockerfile" "ARG NEXT_PUBLIC_APP_VERSION=$From" "ARG NEXT_PUBLIC_APP_VERSION=$To"
Replace-InFile "docker-compose.prod.yml" "APP_VERSION:-$From" "APP_VERSION:-$To"
Replace-InFile "src/Pitbull.Web/pitbull-web/src/lib/app-version.ts" "return `"$From`"" "return `"$To`""
Write-Host "Bumped $From -> $To"
