$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

Write-Host '=== Build API Release ==='
dotnet build src/Pitbull.Api/Pitbull.Api.csproj --configuration Release -v q
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '=== Unit: ProjectAssignmentServiceTests ==='
dotnet test tests/Pitbull.Tests.Unit --configuration Release --no-build:$false `
  --filter "FullyQualifiedName~ProjectAssignmentServiceTests.AssignEmployeeToProjectAsync_ValidRequest"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '=== Unit: ProjectTeamAssignmentServiceTests ==='
dotnet test tests/Pitbull.Tests.Unit --configuration Release --no-build `
  --filter "FullyQualifiedName~ProjectTeamAssignmentServiceTests"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'PASSED'