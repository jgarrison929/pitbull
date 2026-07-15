# Spec: Product band 3.3 â€” Today on site (real entities)

**Status:** In progress (from 3.3.0)
**Version band:** `3.3.0` â†’ `3.3.9` (10 stamps)  
**Theme:** PM/superintendent glance of **todayâ€™s** filed field activity â€” real entities only  
**Starts after:** `3.2.9` security/prod checkpoint  

## Problem

Office and field leads cannot quickly see what was captured **today** on a job (reports, photo counts, open field issues) without portfolio aggregation or invented â€œsite healthâ€ scores.

## Version table

| Version | Deliverable |
|---------|-------------|
| **3.3.0** | Spec + contract note: `TodayOnSiteDto` fields, empty honesty, `?view=mobile` list rules (no portfolio KPIs) |
| **3.3.1** | API: `GET /api/projects/{id}/today-on-site` (or equivalent) slim DTO â€” counts from real daily reports / RFIs for **today** in tenant TZ or UTC day boundary documented |
| **3.3.2** | Integration/unit tests: empty day, one report, permission deny |
| **3.3.3** | UI card on project detail (desktop + phone-friendly) showing today counts + deep links |
| **3.3.4** | Site walk / field hub surface for superintendent (same DTO; no second aggregation path) |
| **3.3.5** | Mobile list polish: loading/empty/error states; label â€œTodayâ€™s field activityâ€ not â€œhealthâ€ |
| **3.3.6** | Help Center: Today on site card + FAQ (real entities only) |
| **3.3.7** | CI notes: persona smoke path for PM/super viewing today card |
| **3.3.8** | Buffer: residual bugs from 3.3.1â€“3.3.7 only (no new scope) |
| **3.3.9** | Checkpoint â€” band complete; VERSION 3.3.9 |

## API / UI touchpoints

- Projects controller/service; daily reports + RFI queries (server-side only)  
- Project detail page; site-walk or field hub  
- help/page.tsx; `docs/ci/` notes  

## Test plan

- Unit: DTO mapping / day boundary helper  
- Integration: endpoint auth + empty + with seed data  
- No client-side portfolio rollup tests  

## Help center

- 3.3.6  

## Truth rules

- Counts only from real entities filed today  
- Empty day is honest empty â€” never fabricate activity  
- No % complete, health score, or portfolio KPI on this card  
- Phone = glance + filtered drill only  

## Non-goals

- Multi-project portfolio â€œtodayâ€ rollup on phone  
- Invented subcontractor scores  
- Full Gantt editing  
