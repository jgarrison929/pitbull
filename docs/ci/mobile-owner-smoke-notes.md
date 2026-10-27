# CI notes — mobile-smoke + owner-signup-smoke

**Band:** 2.21.5 → 2.22.2  
**Workflow:** `.github/workflows/ci.yml`  
**Spec:** `docs/specs/ci-mobile-owner-smoke.md`

## Jobs

| Job | Introduced | Spec / project | Status |
|-----|------------|----------------|--------|
| `mobile-smoke` | 2.21.5 / 2.21.7 | Playwright mobile field report path | **required** via `ci-gate` |
| `owner-signup-smoke` | 2.21.6 | Playwright owner-signup project | **required** via `ci-gate` |
| Role L4 smoke | earlier | existing role-workflows | removed from CI (#608) with the 3.8.2 tree |

## Required checks (2026-10-18 decision, supersedes 2.22.2)

`main` requires the single `ci-gate` check, which needs both smokes. `continue-on-error` is gone. Both jobs were green on 80 of 80 runs that reached them between 2026-08-03 and 2026-10-15; every non-green run was a skip after a build failure. If they start to flake, fix the flake or drop the job from `ci-gate.needs` (advisory). Don't bring back `continue-on-error`.

The 2.22.2 stance kept them optional because GitHub runners might flake on the live API + seeded demo stack. That flakiness never showed up in run history.

Both jobs upload Playwright traces and screenshots on failure. See AGENTS.md "Merging PRs (ci-gate)".

## Version map

| Version | Change |
|---------|--------|
| 2.21.5 | mobile-smoke scaffold |
| 2.21.6 | owner-signup-smoke |
| 2.21.7 | mobile field report in CI |
| 2.22.2 | Required-check notes (this doc); keep continue-on-error until env stable |
| 2026-10-18 | Required via `ci-gate`; `continue-on-error` removed |
