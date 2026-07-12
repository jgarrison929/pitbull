# Spec: CI — mobile + owner-signup smoke

**Status:** Pending  
**Version band:** 2.21.5 → 2.22.2 (subset of Arc E)  
**Related:** `.github/workflows/ci.yml`, `e2e/tests/owner-signup.spec.ts`, `e2e/tests/mobile-field-report.spec.ts`

## Problem

CI runs L4 role smoke; mobile field report and owner signup are not fully gated as required checks for 3.0.0.

## Primary code touchpoints

| Area | Paths |
|------|-------|
| Workflow | `.github/workflows/ci.yml` |
| Owner signup E2E | `e2e/tests/owner-signup.spec.ts` |
| Mobile E2E | `e2e/tests/mobile-field-report.spec.ts` (from Arc A) |
| Role smoke | existing role-workflows job |
| Docs | `docs/ci/` |

## Version table

| Version | Deliverable | Acceptance |
|---------|-------------|------------|
| 2.21.5 | CI job scaffold `mobile-smoke` (may `continue-on-error: true` initially) | Job appears in workflow |
| 2.21.6 | `owner-signup.spec.ts` in CI | Job runs on PR |
| 2.21.7 | `mobile-field-report.spec.ts` in CI | Job runs on PR |
| 2.22.2 | Required checks (or documented why optional) + `docs/ci/` notes | Branch protection guidance in notes |

## Non-goals

- Full visual regression suite  

## Test plan

- PR must run role + owner + mobile paths before Arc E close (required or explicit risk accept)  

## Band DoD

- [ ] Evidence of CI jobs in `docs/ci/` for runway checklist §5  
