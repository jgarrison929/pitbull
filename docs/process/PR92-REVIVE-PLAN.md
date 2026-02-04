# PR #92 (test/api-endpoint-integration) — Rebase/Revive Plan

## Goal
Unblock PR #92 by updating it onto current `develop` so CI failures reflect *real* issues, not stale drift.

## Current state
- PR #92 currently fails:
  - Next.js lint (2 errors)
  - Unit architecture tests (several failures)
- Attempting to merge `develop` into PR branch produces conflicts:
  - `src/Modules/Pitbull.Core/MultiTenancy/TenantMiddleware.cs`
  - `tests/Pitbull.Tests.Integration/Pitbull.Tests.Integration.csproj`

## Smallest next step
Create a fresh branch off `develop` and cherry-pick/re-apply only the integration-test additions from PR #92.

## Risks
- Low/medium: integration tests may need minor edits due to moved/renamed APIs.

## Test plan
- `dotnet test ./Pitbull.sln -c Release`
- CI gates on PR (Build & Test + Build Frontend)

## Next action (manual)
- Open PR from the new branch and either:
  - close PR #92 in favor of the new one, or
  - mark #92 as superseded.
