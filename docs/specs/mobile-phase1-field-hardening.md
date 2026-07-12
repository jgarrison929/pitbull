# Spec: Mobile Phase 1 field hardening

**Status:** In progress (2.12.2 agent infra shipped with program firm-up)  
**Version band:** 2.12.2 → 2.13.2 (11 PRs from 2.12.1)  
**Related:** [`docs/mobile3.md`](../mobile3.md) Phase 1, [`docs/260712/goal-prompts.md`](../260712/goal-prompts.md)

## Problem

Field report flow is used on real devices (PostHog) but chrome conflicts, thin offline SW sync (drops activities/spatial/photos vs client), missing mobile E2E, outdated help, and no performance discipline block production trust.

## Personas

- **Superintendent / field** (demo key `superintendent`) — primary  
- **PM on site** — secondary mobile user  

## User journey

1. Super opens app on phone → bottom nav **Report** → `/daily-reports/mobile`  
2. Completes minimal 4-step field report (weather → work → photos/optional → submit)  
3. Submits online **or** queues offline → full payload (activities, trucks, spatial, plan sheet, photos) syncs on reconnect  
4. Help center documents the real routes  

## Primary code touchpoints

| Area | Paths |
|------|-------|
| Field report UI | `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/daily-reports/mobile/page.tsx` |
| Bottom nav | `src/.../components/layout/mobile-bottom-nav.tsx` |
| Clearance | `src/.../components/layout/mobile-shell.ts` (`MOBILE_MAIN_BOTTOM_CLEARANCE`) |
| Dashboard layout | `src/.../app/(dashboard)/layout.tsx` |
| PWA prompt | `src/.../components/` (search `pwa-install-prompt`) |
| SW | `src/Pitbull.Web/pitbull-web/public/sw.js` |
| Client sync | `src/.../lib/use-online-status.ts` (`syncDailyReport`) |
| Offline store | `src/.../lib/offline-store.ts`, `daily-report-offline.ts` |
| Offline tests | `src/.../__tests__/offline-store.test.ts` |
| PostHog | `src/.../lib/posthog.ts` + capture call sites on field report |
| Help | `src/.../app/(dashboard)/help/page.tsx` |
| E2E (create) | `e2e/tests/mobile-field-report.spec.ts` |
| E2E fixtures | `e2e/fixtures/ROLE-PERSONA-MAP.md` |
| CI notes (create) | `docs/ci/mobile-phase1-notes.md` |

## API touchpoints

- `POST /api/projects/{id}/daily-reports` — full field payload (`data.FieldActivities`, `TruckConditions`, `SpatialNodeId`, `PlanSheetId`, narratives, crew)  
- Offline: idempotency key headers (match client `buildHeaders` / SW `buildSyncHeaders`)  
- Photos: post-create upload path already used by client sync (SW should not silently drop photo queue)  

## Version table

### 2.12.2 — Spec + agent infrastructure

**Deliverable:** Firm program docs, agent-ready specs A–E, PR template, AGENTS expansion; stamp version.

**Files:** `docs/260712/*`, `docs/specs/*`, `AGENTS.md`, `.github/pull_request_template.md`, version stamps, `CHANGELOG.md`

**Acceptance:**
- [x] `VERSION-WORKFLOW` says product ends 2.22.2; major at 2.24.2→3.0.0  
- [x] No live path claims 857/878 PRs to 3.0.0  
- [x] Arc A–E specs meet agent-ready bar  
- [x] PR template has version + preflight + spec link checkboxes  
- [x] VERSION 2.12.1 → 2.12.2  

**Tests:** Docs-only; preflight green  

**Out of scope:** Mobile chrome, SW parity, E2E implementation  

---

### 2.12.3 — Mobile chrome

**Deliverable:** No double fixed bottom bars on field report; PWA prompt above safe area; SW precache field route.

**Files:** `daily-reports/mobile/page.tsx`, `layout.tsx`, `mobile-bottom-nav.tsx`, `mobile-shell.ts`, PWA prompt component, `public/sw.js`, vitest if constants change

**Acceptance:**
- [x] At 390×844, field report wizard primary CTA not covered by bottom nav **or** nav hidden on wizard  
- [x] PWA install prompt sits above bottom nav + `safe-area-inset-bottom`  
- [x] SW precache includes `/daily-reports/mobile` (or documented shell URL)  

**Shipped approach:** Hide `MobileBottomNav` + FAB on field report path; wizard uses `MOBILE_FIELD_WIZARD_ACTION_BAR` at true bottom + safe-area.

**Tests:** `mobile-shell.test.ts` (extend if needed); manual 390×844  

---

### 2.12.4 — Offline sync parity

**Deliverable:** SW daily-report POST body matches client `syncDailyReport` field set.

**Known gap (2026-07-12):** Client sends `FieldActivities`, `TruckConditions`, `TruckNotes`, `SpatialNodeId`, `PlanSheetId`; SW omits them. Align SW (prefer shared serializer module if feasible without breaking SW bundling).

**Files:** `public/sw.js`, optionally extract shared payload builder consumed by SW + client; `offline-store.test.ts`

**Acceptance:**
- [ ] Queued report with `fieldActivities` + `spatialNodeId` survives SW-shaped replay  
- [ ] Unit test asserts payload keys present  
- [ ] Time-entry sync untouched unless required  

**Tests:** `npm test` / vitest offline-store path  

---

### 2.12.5 — Mobile E2E scaffold

**Deliverable:** Playwright file + optional mobile project; may skip full flow until 2.12.6.

**Files:** create `e2e/tests/mobile-field-report.spec.ts`; `e2e/playwright.config.ts` if project needed

**Acceptance:**
- [ ] Spec file exists; superintendent demo login helper reused from role fixtures  
- [ ] Viewport 390×844 set  
- [ ] Test runs (pass or documented skip with issue comment) without crashing suite  

**Tests:** `npx playwright test mobile-field-report` (from e2e dir per repo convention)  

---

### 2.12.6 — Mobile E2E complete

**Deliverable:** Superintendent completes minimal field report in E2E.

**Files:** `mobile-field-report.spec.ts`

**Acceptance:**
- [ ] Demo project seed used  
- [ ] Assert success toast **or** API 201 on submit  
- [ ] Role smoke CI still green  

**Tests:** Playwright green locally  

---

### 2.12.7 — Help field workflows

**Deliverable:** Help section “Field & mobile workflows”.

**Files:** `help/page.tsx`; see `help-center-field-workflows.md`

**Acceptance:**
- [ ] Cards: Daily Field Report, Site Walk, Offline/PWA with 3–5 steps + real `href`s  

**Tests:** Manual href resolve; no office quick-start regression  

---

### 2.12.8 — Help mobile FAQ

**Deliverable:** Replace misleading mobile FAQ; add offline + nav accuracy.

**Files:** `help/page.tsx`

**Acceptance:**
- [ ] Remove or rewrite “fully responsive” FAQ (current string claims generic responsive + time tracking only)  
- [ ] Document `/daily-reports/mobile`, bottom nav, crew entry, PWA, offline queue  

**Tests:** Grep help page for “fully responsive” → gone or accurate  

---

### 2.12.9 — PostHog field funnel

**Deliverable:** Funnel steps with `viewport_class`; align with existing events.

**Existing:** CHANGELOG documents `field_report_submitted` (online/offline). **Extend** that event (properties) rather than inventing a conflicting `field_report_completed` without migration note.

**Files:** field report page + posthog helpers; spec addendum event table

**Acceptance:**
- [ ] Step and submit events include `viewport_class` (e.g. `phone` / `desktop`)  
- [ ] Offline submit still captures with online/offline flag  
- [ ] Event names documented in this spec §Analytics  

**Tests:** Vitest for pure helpers if extracted  

---

### 2.13.0 — List virtualization

**Deliverable:** Virtualize **one** mobile-heavy list (prefer time-tracking mobile list or project RFIs mobile).

**Files:** Chosen list page under `time-tracking/mobile` or `projects/[id]/rfis`; TanStack Virtual or existing pattern

**Acceptance:**
- [ ] Only window of rows rendered; server pagination unchanged  
- [ ] Smooth scroll with 200+ seed rows (or mock)  

**Tests:** Vitest/render smoke if practical; manual  

---

### 2.13.1 — Slim mobile API

**Deliverable:** `?view=mobile` or dedicated DTO for **one** high-traffic list endpoint.

**Files:** API controller + service + frontend consumer (phone only)

**Acceptance:**
- [ ] Document endpoint name in this row + CHANGELOG  
- [ ] Integration or unit test: field count or payload smaller than default  
- [ ] Desktop default shape unbroken  

**Tests:** Integration test or contract test  

---

### 2.13.2 — Arc A checkpoint

**Deliverable:** Acceptance doc + mark this spec shipped.

**Files:** create `docs/ci/mobile-phase1-notes.md`; this spec Status

**Acceptance:**
- [ ] All version rows 2.12.3–2.13.1 checked or P0 gap listed with owner  
- [ ] Notes include test commands + manual QA  
- [ ] Status: `Shipped through 2.13.2`  

**Tests:** preflight -FullWeb -DotNet  

## Analytics (2.12.9)

| Event | When | Properties |
|-------|------|------------|
| `field_report_submitted` (existing) | Online submit or offline queue success | `online`, `viewport_class`, optional `step_count` |
| `field_report_step_completed` (optional) | Each wizard step | `step`, `viewport_class` |

## Non-goals (Arc A)

- Plans field viewer (Arc B)  
- Twin photo pins (Arc D)  
- AI voice (Arc E)  
- Native apps  

## Test plan (band)

```powershell
# Web unit
cd src/Pitbull.Web/pitbull-web; npm test -- --run offline-store mobile-shell
# E2E (after 2.12.6)
# from repo e2e conventions — see mobile-phase1-notes after 2.13.2
./scripts/preflight.ps1 -FullWeb -DotNet
```

## Help center

See [`help-center-field-workflows.md`](./help-center-field-workflows.md).

## Truth rules

- Offline sync must not drop field activities, trucks, spatial, plan sheet, or photos silently  
- PostHog events are diagnostic — not executive KPIs  

## Band DoD (2.13.2)

- [ ] Chrome + offline parity + mobile E2E green  
- [ ] Help accurate for field  
- [ ] At least one virtualized list + one slim mobile API  
- [ ] `docs/ci/mobile-phase1-notes.md` committed  
