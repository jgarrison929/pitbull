# Spec: Mobile Phase 2 — plans & specs viewer

**Status:** In progress (2.13.3 wireframe notes)  
**Version band:** 2.13.3 → 2.14.2 (10 PRs)  
**Related:** [`docs/mobile3.md`](../mobile3.md) Phase 2, [`pitbull-digital-twin-spec.md`](../pitbull-digital-twin-spec.md) §4

## Problem

Plans route exists (`/projects/[id]/plans-specs`) but admin CRUD dominates on phone; field needs viewer-first UX, offline metadata cache, and explicit `PlanSheetId` pick on field report (payload already supports it).

## Personas

Superintendent, PM on site walk.

## User journey

1. Super opens project hub → **Plans & Specs**  
2. Search sheet number → view PDF with touch-friendly controls  
3. From field report → pick plan sheet → `PlanSheetId` on submit  
4. Offline: recent sheets metadata cached on Wi-Fi  

## Primary code touchpoints

| Area | Paths |
|------|-------|
| Plans page | `src/.../app/(dashboard)/projects/[id]/plans-specs/page.tsx` |
| Project nav | `src/.../lib/project-nav.ts` |
| Field report | `src/.../app/(dashboard)/daily-reports/mobile/page.tsx` |
| Offline / SW | `public/sw.js`, `offline-store.ts` |
| Twin fuel helpers | search `PlanSheetId` / plan sheet in web lib |
| Help | `help/page.tsx` |
| Notes (create) | `docs/ci/mobile-phase2-notes.md` |

## API touchpoints

- Existing plan sheet list/detail/download APIs (document exact routes in 2.13.3 row when implementing)  
- Field report POST `data.PlanSheetId` (already in client sync)  
- Permissions: project document/plan read for field roles  

## Version table

| Version | Deliverable | Files (primary) | Acceptance | Tests |
|---------|-------------|-----------------|------------|-------|
| **2.13.3** | Spec finalized; field-mode wireframe notes in this file | this spec | Wireframe: viewer tab default on `<lg`; admin CRUD desktop-first | docs |
| **2.13.4** | Field-only viewer tab; hide admin CRUD on phone (`lg:hidden` / `max-lg:`) | plans-specs page | Phone shows viewer; no primary “upload/admin” CTA blocking view | manual 390×844 |
| **2.13.5** | PDF touch targets + mobile search layout | plans-specs + PDF viewer components | Min 44px controls; sheet search usable one-handed | manual |
| **2.13.6** | Site walk deep link → plans with sheet filter | site-walk page, plans-specs query params | Link from walk opens plans with filter applied | manual / vitest href |
| **2.13.7** | Revision label (“Rev N”) on viewer | plans-specs | Label from API revision fields — no invented “latest” | unit if pure format fn |
| **2.13.8** | Help: Plans on site workflow card | help/page.tsx | Card with real deep link | manual |
| **2.13.9** | Vitest plans-specs mobile layout helpers | `*.test.ts` near plans components | Tests pass | vitest |
| **2.14.0** | PlanSheetId picker on field report | daily-reports/mobile | Optional picker; value in submit + offline payload | vitest offline payload |
| **2.14.1** | SW cache plan metadata for active project | sw.js | Cache key documented; offline list shows cached sheets or honest empty | manual |
| **2.14.2** | Arc B checkpoint | docs/ci/mobile-phase2-notes.md | Spec Status shipped through 2.14.2 | preflight |

## Non-goals

- Full plan markup/RFI from PDF (later)  
- Full offline PDF binary cache of entire set (metadata first; PDF best-effort only if cheap)  

## Truth rules

- Show revision date/source from API — do not invent “latest” without data  

## Band DoD (2.14.2)

- [ ] Field viewer usable at 390×844  
- [ ] PlanSheetId selectable on field report  
- [ ] Help + notes committed  

## Field-mode wireframe notes (2.13.3)

**Viewport policy**

| Viewport | Default surface | Admin / CRUD |
|----------|-----------------|--------------|
| `<lg` (phone / small tablet) | **Viewer-first** — sheet search + PDF viewer | Hidden or secondary; no primary upload CTA above the fold |
| `≥lg` (desktop) | Viewer + full admin CRUD | Upload, replace, delete, metadata edit as today |

**Phone layout (390×844)**

1. Sticky top: project breadcrumb + sheet search (min 44px input).
2. Sheet list (virtualized later if needed) — tap opens viewer.
3. Viewer chrome: zoom / page with 44px targets; revision label from API (2.13.7).
4. No blocking admin dialogs on first paint.

**Desktop**

- Keep existing admin tabs/actions; field viewer remains available as a tab.

**Deep links (later rows)**

- Site walk → `/projects/{id}/plans-specs?sheet=…` (2.13.6)
- Field report → `PlanSheetId` picker (2.14.0)

**API routes to document as implemented**

- List/detail/download plan sheets under project documents API (exact paths confirmed when 2.13.4 touches page).
