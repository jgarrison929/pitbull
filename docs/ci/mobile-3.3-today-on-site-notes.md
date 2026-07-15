# Mobile / Today on site 3.3.x — CI & verification notes

**Band:** `3.3.0` → `3.3.9`  
**Status:** In progress (notes from 3.3.7; checkpoint at 3.3.9)  
**Spec:** `docs/specs/product-bands/band-3.3-today-on-site.md`

## Outcomes

| Version | Outcome |
|---------|---------|
| 3.3.0 | Contract: TodayOnSiteDto + UTC day window; no portfolio KPIs |
| 3.3.1 | API `GET /api/projects/{id}/today-on-site` real counts |
| 3.3.2 | Client helpers + unit tests (empty honesty) |
| 3.3.3 | Project detail UI card |
| 3.3.4 | Site Walk same DTO path (no second aggregation) |
| 3.3.5 | Mobile empty copy: field activity not health |
| 3.3.6 | Help Center cards + FAQ |
| 3.3.7 | This CI notes file + persona smoke path |
| 3.3.8 | Buffer residual only |
| 3.3.9 | Band checkpoint |

## Persona smoke path (PM / Superintendent)

Required Role E2E already covers demo login shells. Manual / optional smoke for Today on site:

1. Demo login as **pm** (`pm@demo.local`) or **superintendent** (`superintendent@demo.local` / foreman alias).
2. Open **Projects** → pick an active demo job.
3. Confirm project detail shows **Today's field activity** card (or honest empty).
4. Open **Site Walk** for the same job — same counts source (GET today-on-site).
5. Open **Help** → section **Today on site** — cards explain real entities only.

**Do not assert** invent health scores, % complete, or multi-project portfolio rollups on phone.

## Test commands

```powershell
cd src/Pitbull.Web/pitbull-web
npm test -- --run today-on-site site-walk-today-on-site help-today-on-site

# API unit (when present)
dotnet test tests/Pitbull.Tests.Unit --filter "FullyQualifiedName~TodayOnSite"
```

## CI policy (merge gate)

| Check | Required? |
|-------|-----------|
| Build & Test (.NET) | Yes |
| Build Frontend (Next.js) | Yes |
| Role E2E Smoke (Playwright L4) | Yes |
| CodeQL | Yes |
| Mobile field report smoke | Optional (continue-on-error) |
| Owner signup smoke | Optional (continue-on-error) |

## Truth rules

- Counts only from real entities filed today (UTC day documented on API)
- Empty day is honest empty
- No % complete, health score, or portfolio KPI on the card
- Phone = glance + filtered drill only
