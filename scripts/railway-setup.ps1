#Requires -Version 5.1
<#
.SYNOPSIS
  Generate Railway environment variable templates for Pitbull deployment.

.DESCRIPTION
  Prints a copy-paste checklist for Railway dashboard setup and optionally
  writes deploy/railway.env.template (gitignored).

.PARAMETER ApiUrl
  Public API URL (e.g. https://pitbull-api-production.up.railway.app)

.PARAMETER WebUrl
  Public Web URL (e.g. https://pitbull-web-production.up.railway.app)

.PARAMETER DemoPassword
  Demo user password. Generated if omitted.

.PARAMETER WriteTemplate
  Write deploy/railway.env.template with generated secrets.

.EXAMPLE
  .\scripts\railway-setup.ps1 -ApiUrl "https://pitbull-api-production.up.railway.app" -WebUrl "https://pitbull-web-production.up.railway.app"
#>
param(
    [string]$ApiUrl = "",
    [string]$WebUrl = "",
    [string]$DemoPassword = "",
    [switch]$WriteTemplate
)

$ErrorActionPreference = "Stop"

function New-RandomSecret {
    param([int]$Length = 48)
    $bytes = New-Object byte[] $Length
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', 'x').Replace('/', 'y').Substring(0, $Length)
}

$jwtKey = New-RandomSecret -Length 48
if ([string]::IsNullOrWhiteSpace($DemoPassword)) {
    $DemoPassword = New-RandomSecret -Length 16
}

if ([string]::IsNullOrWhiteSpace($ApiUrl)) {
    $ApiUrl = Read-Host "API public URL (e.g. https://pitbull-api-production.up.railway.app)"
}
if ([string]::IsNullOrWhiteSpace($WebUrl)) {
    $WebUrl = Read-Host "Web public URL (e.g. https://pitbull-web-production.up.railway.app)"
}

$apiVars = @"
# === pitbull-api service variables ===
DATABASE_URL=`${{Postgres.DATABASE_URL}}
Jwt__Key=$jwtKey
Jwt__Issuer=pitbull-api
Jwt__Audience=pitbull-client
Cors__AllowedOrigins__0=$WebUrl
ASPNETCORE_ENVIRONMENT=Production

# Demo mode (portfolio / public demo)
Demo__Enabled=true
Demo__SeedOnStartup=true
Demo__DisableRegistration=true
Demo__TenantSlug=demo
Demo__TenantName=Pitbull Demo
Demo__UserEmail=demo@example.com
Demo__UserPassword=$DemoPassword
SeedData__AllowInNonDevelopment=true
"@

$webVars = @"
# === pitbull-web service variables ===
# Redeploy web after changing this (build-time variable)
NEXT_PUBLIC_API_BASE_URL=$ApiUrl
"@

Write-Host ""
Write-Host "=== Railway Setup Checklist ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Create Railway project from GitHub: jgarrison929/pitbull" -ForegroundColor Yellow
Write-Host "2. Add Postgres plugin"
Write-Host "3. Configure pitbull-api: Root Directory = / (repo root)"
Write-Host "4. Configure pitbull-web: Root Directory = src/Pitbull.Web/pitbull-web"
Write-Host "5. Generate public domains for both services"
Write-Host "6. Paste variables below into each service"
Write-Host ""
Write-Host "--- API variables ---" -ForegroundColor Green
Write-Host $apiVars
Write-Host ""
Write-Host "--- Web variables ---" -ForegroundColor Green
Write-Host $webVars
Write-Host ""
Write-Host "--- Demo login ---" -ForegroundColor Magenta
Write-Host "  Email:    demo@example.com"
Write-Host "  Password: $DemoPassword"
Write-Host ""
Write-Host "--- Smoke test after deploy ---" -ForegroundColor Cyan
Write-Host "  curl $ApiUrl/health/live"
Write-Host "  curl $ApiUrl/api/version"
Write-Host "  Open $WebUrl"
Write-Host ""
Write-Host "Full guide: deploy/RAILWAY-SETUP.md" -ForegroundColor Gray

if ($WriteTemplate) {
    $templatePath = Join-Path (Split-Path $PSScriptRoot -Parent) "deploy\railway.env.template"
    $content = @"
# Generated $(Get-Date -Format 'yyyy-MM-dd HH:mm')
# DO NOT COMMIT — add deploy/railway.env.template to .gitignore

$apiVars

$webVars
"@
    Set-Content -Path $templatePath -Value $content -Encoding UTF8
    Write-Host "Wrote $templatePath" -ForegroundColor Green
}