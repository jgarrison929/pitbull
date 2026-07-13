# CI notes — mobile-smoke + owner-signup-smoke

**Band:** 2.21.5 → 2.22.2  
**Workflow:** `.github/workflows/ci.yml`  
**Spec:** `docs/specs/ci-mobile-owner-smoke.md`

## Jobs

| Job | Introduced | Spec / project | `continue-on-error` |
|-----|------------|----------------|---------------------|
| `mobile-smoke` | 2.21.5 / 2.21.7 | Playwright mobile field report path | **true** (see below) |
| `owner-signup-smoke` | 2.21.6 | `e2e` project `owner-signup` | **true** (see below) |
| Role L4 smoke | earlier | existing role-workflows | required with main CI |

## Required checks vs optional (2.22.2 decision)

**Branch protection (recommended):** require the main CI aggregate / unit+web jobs that already gate PRs. Do **not** mark `mobile-smoke` or `owner-signup-smoke` as required branch checks until both are green without `continue-on-error` on a stable demo stack.

**Why still optional (`continue-on-error: true`):**

1. Playwright jobs need a live API + seeded demo env; GitHub runners can flake when secrets, DB, or cold starts lag.
2. Owner signup and mobile field report are high-value regression nets but not the only coverage — unit tests + FullWeb preflight + role smoke already block bad merges.
3. Keeping the jobs on every PR still surfaces failures in Checks (red X with continued workflow) without blocking unrelated docs/API fixes during runway.

**Risk accepted:** a merge can land while mobile/owner E2E is red. Mitigations:

- Local: `./scripts/preflight.ps1 -FullWeb -DotNet` before push  
- Runway checklist §5: re-evaluate making these required after demo CI env is hardened  
- Artifacts: both jobs upload Playwright traces/screenshots on failure  

## Evidence for runway checklist §5

- Jobs present in `ci.yml` (mobile-smoke, owner-signup-smoke)  
- Spec Status shipped through 2.22.2 with honest optional flag  
- This file + workflow comments document the protection guidance  

## Version map

| Version | Change |
|---------|--------|
| 2.21.5 | mobile-smoke scaffold |
| 2.21.6 | owner-signup-smoke |
| 2.21.7 | mobile field report in CI |
| 2.22.2 | Required-check notes (this doc); keep continue-on-error until env stable |
