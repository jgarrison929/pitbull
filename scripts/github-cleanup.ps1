#Requires -Version 5.1
<#
.SYNOPSIS
  Clean up GitHub repository settings after going public.

.DESCRIPTION
  Run AFTER: gh auth login
  Run FROM:   repo root

  This script tidies stale issues, milestones, branches, and repo metadata
  for a portfolio-ready public repository.

.PARAMETER Repo
  GitHub repo in owner/name format. Defaults to jgarrison929/pitbull.

.PARAMETER DryRun
  Print actions without executing them.

.EXAMPLE
  .\scripts\github-cleanup.ps1
  .\scripts\github-cleanup.ps1 -Repo jgarrison929/pitbull-private -DryRun
#>
param(
    [string]$Repo = "jgarrison929/pitbull",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Invoke-Gh {
    param([string[]]$Args)
    $cmd = "gh " + ($Args -join " ")
    if ($DryRun) {
        Write-Host "[dry-run] $cmd" -ForegroundColor Yellow
        return
    }
    & gh @Args
    if ($LASTEXITCODE -ne 0) { throw "gh failed: $cmd" }
}

Write-Host "Checking gh authentication..." -ForegroundColor Cyan
& gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Error "Not logged in. Run: gh auth login"
}

Write-Host "`n=== Repo metadata: $Repo ===" -ForegroundColor Cyan
Invoke-Gh @(
    "repo", "edit", $Repo,
    "--description", "Learning project: full-stack construction ERP (.NET 9 + Next.js 16 + PostgreSQL). MIT licensed portfolio piece.",
    "--homepage", "https://demo.example.com",
    "--enable-wiki=false",
    "--enable-projects=false"
)
Invoke-Gh @("repo", "edit", $Repo, "--add-topic", "construction", "--add-topic", "dotnet", "--add-topic", "nextjs", "--add-topic", "postgresql", "--add-topic", "erp", "--add-topic", "portfolio")

Write-Host "`n=== Default branch -> main ===" -ForegroundColor Cyan
Invoke-Gh @("repo", "edit", $Repo, "--default-branch", "main")

Write-Host "`n=== Close completed / stale issues ===" -ForegroundColor Cyan
$closeIssues = @(
    @{ Number = 118; Comment = "Completed Feb 2026 - MediatR removed, direct service injection in all controllers." }
    @{ Number = 15;  Comment = "Documents module shipped - file upload/download with tenant isolation." }
    @{ Number = 17;  Comment = "Billing module shipped - AIA G702/G703 payment applications, SOV, retention." }
)
foreach ($issue in $closeIssues) {
    Invoke-Gh @("issue", "comment", $issue.Number, "--repo", $Repo, "--body", $issue.Comment)
    Invoke-Gh @("issue", "close", $issue.Number, "--repo", $Repo, "--reason", "completed")
}

Write-Host "`n=== Close empty milestones ===" -ForegroundColor Cyan
$milestones = & gh api "repos/$Repo/milestones?state=open" 2>$null | ConvertFrom-Json
foreach ($m in $milestones) {
    if ($m.open_issues -eq 0) {
        Write-Host "Closing milestone #$($m.number): $($m.title)"
        Invoke-Gh @("api", "-X", "PATCH", "repos/$Repo/milestones/$($m.number)", "-f", "state=closed")
    }
}

Write-Host "`n=== Delete stale remote branches ===" -ForegroundColor Cyan
$keepBranches = @("main")
$branches = & gh api "repos/$Repo/branches?per_page=100" 2>$null | ConvertFrom-Json
foreach ($branch in $branches) {
    $name = $branch.name
    if ($keepBranches -contains $name) { continue }
    if ($name -match "^(dependabot/|fix/|feature/|staging$|develop$)") {
        Write-Host "Deleting branch: $name"
        Invoke-Gh @("api", "-X", "DELETE", "repos/$Repo/git/refs/heads/$name")
    }
}

Write-Host "`n=== Done ===" -ForegroundColor Green
Write-Host @"

Manual steps remaining (GitHub UI):
  1. Settings -> General -> Change visibility to Public (if using pitbull-private)
  2. Settings -> Branches -> Remove branch protection rules on develop/staging (if deleted)
  3. Settings -> Secrets -> Rotate RESEND_API_KEY and any Railway secrets
  4. Archive or delete the duplicate repo if consolidating pitbull + pitbull-private
  5. Add a social preview image (Settings -> General -> Social preview)

To push cleaned code:
  git push origin chore/public-prep
  gh pr create --title "chore: prepare for public portfolio release" --body "MIT license, README rewrite, internal doc removal"
"@