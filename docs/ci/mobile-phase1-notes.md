# Mobile Phase 1 (Arc A) — CI & verification notes

**Band:** 2.12.3 → 2.13.2  
**Status:** Shipped through 2.13.2  

## Test commands

```powershell
# Web unit (field/mobile helpers)
cd src/Pitbull.Web/pitbull-web
npm test -- --run help-field-workflows field-report-analytics list-virtualization offline-store mobile-shell posthog-viewport

# API unit (slim mobile projects list)
cd ../../../
dotnet test tests/Pitbull.Tests.Unit/Pitbull.Tests.Unit.csproj --filter "FullyQualifiedName~ProjectMobileListViewTests"

# E2E field report (requires API + web + Demo)
cd e2e
npm run test:mobile-field
npm run test:roles

# Full preflight
./scripts/preflight.ps1 -FullWeb -DotNet
```

## Manual QA (390×844)

1. `/daily-reports/mobile` — single bottom action bar (no double fixed bars)
2. Field report 4-step submit online; offline queue indicator if offline
3. Help → Field & mobile workflows deep links
4. Project RFIs on phone — virtualized mobile list scrolls
5. Time tracking mobile project picker uses `?view=mobile`

## Version map (Arc A)

| Version | Deliverable |
|---------|-------------|
| 2.12.3 | Mobile chrome |
| 2.12.4 | Offline SW sync parity |
| 2.12.5 | E2E scaffold |
| 2.12.6 | E2E complete |
| 2.12.7 | Help field workflows |
| 2.12.8 | Help mobile FAQ |
| 2.12.9 | PostHog viewport_class funnel |
| 2.13.0 | RFI mobile list virtualization |
| 2.13.1 | `GET /api/projects?view=mobile` |
| 2.13.2 | Arc A checkpoint (this doc) |

## P0 gaps

None at checkpoint. Residual E2E weather submit was landed under 2.12.6 residual / main path.

## CI mobile-smoke (2.21.5)

**Job:** `mobile-smoke` in `.github/workflows/ci.yml`  
**continue-on-error:** `true` (scaffold; may become required by 2.22.2)  
**Project:** Playwright `mobile-field-report` after `setup-roles`

| Needs | build-backend, build-frontend |
| Stack | Postgres 17 + demo seed API + Next start |

