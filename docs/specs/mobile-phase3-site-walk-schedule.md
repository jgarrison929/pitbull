# Spec: Mobile Phase 3 — site walk & schedule

**Status:** Shipped through 2.15.2  
**Version band:** 2.14.3 → 2.15.2 (10 PRs)  
**Related:** [`docs/mobile3.md`](../mobile3.md) Phase 3

## Problem

Site walk and schedule exist but lack a unified “start walk” mode, schedule→progress bridge, and sub status tap actions on phone.

## Personas

Superintendent, PM.

## User journey

1. Open active project → **Site Walk** or home banner “Today on this job”  
2. Glance today’s schedule cards; filter critical path  
3. Tap activity → draft progress / open related RFIs for sub  
4. Optional: open twin when flag on  

## Primary code touchpoints

| Area | Paths |
|------|-------|
| Site walk | `src/.../projects/[id]/site-walk/page.tsx` |
| Schedule | `src/.../projects/[id]/schedule/page.tsx` |
| Progress | `src/.../projects/[id]/progress/page.tsx` |
| RFIs | `src/.../projects/[id]/rfis/page.tsx` |
| Twin | `src/.../projects/[id]/twin/page.tsx` |
| Field home / last-job | role-views field dashboard components |
| Field report | `daily-reports/mobile/page.tsx` |
| Help | `help/page.tsx` |
| Notes | create `docs/ci/mobile-phase3-notes.md` |

## API touchpoints

- Schedule activities/dependencies list endpoints (fixed in 2.12.1 for 405s)  
- Progress create draft APIs  
- RFI list filtered by sub/vendor if available  
- Feature flag `features.digitalTwin` for twin link  

## Version table

| Version | Deliverable | Acceptance | Tests |
|---------|-------------|------------|-------|
| **2.14.3** | Unified site walk entry (“Today on this job” banner) | Banner on field/PM home or project hub links to site-walk | manual |
| **2.14.4** | Schedule look-ahead: status tap → progress draft | Tap opens progress with activity preselected or query param | manual |
| **2.14.5** | Critical-path filter on mobile schedule cards | Filter toggle works; empty state honest | vitest filter pure fn if extracted |
| **2.14.6** | Sub status: tap → open RFIs for sub | Deep link filters RFIs; no fake health score | manual |
| **2.14.7** | Site walk → twin link when feature flag on | Hidden when flag off | unit flag helper |
| **2.14.8** | Help: site walk workflow | Card + FAQ | manual |
| **2.14.9** | PostHog `site_walk_started` | Captured with projectId + viewport_class | vitest/manual |
| **2.15.0** | Deep link schedule activity from field report | Optional activity link field or query | manual |
| **2.15.1** | Mobile schedule empty states | Honest copy when no activities | manual |
| **2.15.2** | Arc C checkpoint + notes | Spec Status shipped through 2.15.2 | preflight |

## Non-goals

- Full Gantt editing on phone  
- Invented subcontractor “health scores”  

## Truth rules

- Sub “health” uses existing ranked signals only — **label proxies**  
- Never invent schedule % complete  

## Band DoD (2.15.2)

- [x] Walk entry + schedule bridge + help + notes  
