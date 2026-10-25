# Mobile/field demand stack → Pitbull gaps → post-3.0 version plan

**Status:** Analysis complete; **3.1.0–3.1.9 field band implemented** (see `docs/specs/product-bands/band-3.1-field-mobile.md`)  
**Product version at writing:** was `3.0.0`; live ladder shipped as **`3.1.0`→`3.1.9`** (OBJECTIVE skipped 3.0.1–3.0.9).  
**Related:** [`docs/mobile3.md`](../mobile3.md), phase specs under `docs/specs/mobile-phase*.md`, [`docs/roadmap/post-3.0-product-bands.md`](./post-3.0-product-bands.md), market research session (2026 field adoption / offline / field–office divide).

---

## 1. 2026 demand stack (ranked)

Market severity order for construction **mobile** (field crews and supers). Rank is consistent with 2026 field-app reviews, Dodge/ABC field–office research, and common G2-style adoption complaints: **adoption > offline > capture > field→office > drawings > AI multiplier**.

| Rank | Demand | Why it matters |
|------|--------|----------------|
| **1** | **Field adoption / usability** | If the app is not usable in ~15 minutes on site (gloves, sun, interruption), crews revert to texts and paper and the whole stack is wasted. |
| **2** | **True offline** | Basements, concrete, rural sites have no signal; apps that only “work on Wi‑Fi” lose trust on the first dead zone. |
| **3** | **Zero-friction capture** | Phone job is capture: photo, narrative, task, log in seconds—not desktop ERP forms shrunk to a phone. |
| **4** | **Field→office visibility** | Office decisions lag because site reality lives in SMS/photos; mobile must produce trustworthy, auto-filed records without chasing calls. |
| **5** | **Drawing-context work** | Supers need current sheets offline, fast, with pin-the-problem (markup → issue/RFI/task) so context is not retyped. |
| **6** | **AI assist (multiplier)** | Voice→structure, photo flags, EOD summaries save time **only after** capture/offline/adoption work; never auto-post progress. |

**Product rule alignment (already in Agents.md / mobile3):** PWA-first; phone = **capture + glance + filtered drill**; no client-side portfolio aggregation; truth over polish; no invented KPIs.

---

## 2. Pitbull surface map

Statuses: **covered** (meets demand for MVP/product bar), **partial** (shipped core but market still feels a hole), **gap** (explicit non-goal or missing).

Evidence is phase specs (Status: Shipped…), CI notes, or named source under `src/Pitbull.Web/pitbull-web`.

| Surface | Primary paths / specs | Demand fit | Status | Notes |
|---------|----------------------|------------|--------|-------|
| **Field report (4-step wizard)** | `app/(dashboard)/daily-reports/mobile/page.tsx`; `docs/specs/mobile-phase1-field-hardening.md` (through 2.13.2); E2E `e2e/tests/mobile-field-report.spec.ts` | 1 adoption, 3 capture, 4 field→office | **partial** | Strong capture path (weather → work → photos → submit). Chrome fixed (hide bottom nav on wizard). Still multi-step; not “two photos + 15s voice” magic bar from mobile3 vision. |
| **Bottom nav + field role chrome** | `components/layout/mobile-bottom-nav.tsx`, `mobile-shell.ts`, `workspaces.ts` (`field` / Foreman `mobileTabs`: Report, etc.) | 1 adoption | **covered** | Role-aware tabs + Report deep link; wizard clearance shipped in phase 1. |
| **PWA + service worker** | `public/sw.js` (precache `/daily-reports/mobile`, plan-sets metadata network-first, daily-report sync tag) | 1–2 adoption/offline | **partial** | PWA shell + offline queue for daily reports and time entry. Not a full field offline shell (drawings binaries, arbitrary routes). |
| **Offline queue / store** | `lib/offline-store.ts`, `lib/daily-report-offline.ts`, `lib/offline-photo.ts`; phase1 2.12.4 parity | 2 offline, 3 capture | **partial** | Full daily-report payload keys (activities, spatial, PlanSheetId) sync via SW + client. Photos: **small only** (`MAX_OFFLINE_PHOTO_BYTES` ~1.2MB, max 5); large skipped with honesty. No general offline media vault. |
| **Plans & specs viewer** | `app/(dashboard)/projects/[id]/plans-specs/page.tsx`; `docs/specs/mobile-phase2-plans-viewer.md` (through 2.14.2); `docs/ci/mobile-phase2-notes.md` | 5 drawing-context | **partial** | Viewer-first on phone; sheet search; revision label from API; `PlanSheetId` on field report; **SW caches plan-set metadata only**. **Non-goals in phase 2:** full markup→RFI; full offline PDF binary cache. |
| **Site walk + schedule** | `projects/[id]/site-walk`, `schedule`, progress/RFI deep links; phase3 through 2.15.2 | 1 adoption, 4 field→office, glance | **partial** | “Today on this job,” critical filter, schedule→progress, sub→RFIs, honest empty states. Not full offline schedule; no Gantt edit on phone (correct non-goal). |
| **Twin field hooks** | `projects/[id]/twin`; field report `SpatialNodeId`; site-walk twin link when flag on; `ROLE-EXPERIENCE.md` | 3 capture context, 5 spatial | **partial** | Optional zone on report; walk→twin when `NEXT_PUBLIC_FEATURE_DIGITAL_TWIN`. Overlay truth rules (proxies labeled). Not AR/BIM overlay demand. |
| **AI field bits** | `docs/specs/mobile-ai-intelligence.md` through 2.21.2; voice suggestion, photo safety flag, EOD rule-based + optional LLM flag OFF | 6 AI | **covered** (MVP) | Confirm-to-apply; offline AI disabled with honest copy; no auto-post; rate limits/demo safety. Multiplier only—does not close #1–#5. |
| **Help (field workflows)** | `help/page.tsx`; `docs/specs/help-center-field-workflows.md` | 1 adoption (discoverability) | **covered** | Field cards: Daily Field Report, Site Walk, Offline/PWA; FAQ truthful routes; plans/twin pointers. |

### Cross-cutting demand × status

| Demand (rank) | Overall Pitbull | Biggest evidence of hole |
|---------------|-----------------|---------------------------|
| 1 Adoption | **partial** | Foundation strong; still risk of multi-app / multi-step vs competitor field-first tools. |
| 2 True offline | **partial → gap on drawings/media** | Report queue solid; PDF binary + large photos not true offline. |
| 3 Zero-friction capture | **partial** | Field report exists; photo size limits offline; no pin-from-plan capture loop. |
| 4 Field→office | **partial** | Reports/progress/RFIs sync when online; no dedicated “what happened on site today” office glance productized as a field-doc story. |
| 5 Drawing-context | **partial → gap on markup** | View + PlanSheetId; no markup→RFI/task. |
| 6 AI assist | **covered** (MVP) | Intelligence band shipped; keep as assist-only. |

---

## 3. Biggest gaps (top 5)

Ordered by **market severity × product leverage** (not a laundry list).

| # | Gap | Severity × leverage | Demand ranks | Why now (post-3.0) |
|---|-----|---------------------|--------------|-------------------|
| **G1** | **Offline photo reliability** — large jobsite photos skipped offline; max 5 embeds | High × high | 2, 3, 4 | Capture is the daily habit. Skipping media in dead zones recreates SMS photo chaos and undermines field→office truth. Builds on existing queue; smaller than full PDF offline. |
| **G2** | **True offline plan sheets (selected PDFs)** — metadata cache only today | High × high | 2, 5 | Market treats offline drawings as table stakes. Phase 2 deliberately deferred binary cache; now the highest drawing gap after viewer UX shipped. Scope **active project + recently viewed sheets**, not entire set. |
| **G3** | **Plan pin → issue/RFI draft** (minimal markup) | High × medium-high | 5, 3, 4 | mobile3 “I gotta have this” explicitly includes RFI from plan markup; phase 2 non-goal. Highest differentiation after basic offline drawings. Keep phone = pin + photo + note, not Bluebeam. |
| **G4** | **Field capture time-to-submit** (faster path / fewer steps for common day) | Medium-high × high | 1, 3 | Adoption fails when wizard feels long vs texting. Leverage: same APIs; slim “quick log” or smarter defaults without inventing KPIs. |
| **G5** | **Office glance of today’s field capture** (honest list: reports/photos/issues filed today per job) | Medium × medium | 4 | Closes field–office divide for PMs without new executive KPIs—just real entities already in system, labeled as operational activity not portfolio health. |

**Not in top gaps (already OK or deferred correctly):** native shell; full Gantt on phone; AI auto-posting; invented sub “health scores”; re-shipping Arc A–E.

---

## 4. Incremental version plan (post-3.0.0)

**Rules:** one version bump per PR; PWA-first; phone = capture / glance / filtered drill; truth over polish; no invented KPIs; write band spec before implementing multi-PR bands (`docs/specs/product-bands/`).

**Ladder starts at `3.0.1`.** Do **not** reopen 2.12–2.22 Arc A–E numbers as live work.

### Band M1 — Offline capture hardening (`3.0.1` → `3.0.8`)

**Outcome:** Field photos and report media survive real offline conditions without silent loss; honest UX when limits still apply.

| Version | Outcome (single PR) | Primary surfaces |
|---------|---------------------|------------------|
| **3.0.1** | Spec: offline media + compression policy (limits, honesty copy) | `docs/specs/product-bands/band-3.0-offline-capture.md` (new) |
| **3.0.2** | Client-side image downscale before offline embed (raise effective capture rate under size cap) | `offline-photo.ts`, field report photo step |
| **3.0.3** | Raise/queue strategy: more than 5 photos via chunked queue or deferred upload tokens (document real behavior) | `offline-store.ts`, SW daily-report photo path |
| **3.0.4** | SW + client parity tests for multi-photo offline payload | `offline-store` / offline-photo tests, `sw.js` if needed |
| **3.0.5** | UI: clear “queued / skipped / will upload on Wi‑Fi” states on field report | `daily-reports/mobile` |
| **3.0.6** | Help: Offline photos FAQ accurate to new limits | `help/page.tsx` |
| **3.0.7** | PostHog: offline photo skip vs queue rates (diagnostic only) | `posthog` + field report |
| **3.0.8** | Checkpoint — Offline capture band | `docs/ci/mobile-offline-capture-notes.md` |

**Closes:** G1 (primary), supports G4.

---

### Band M2 — Selected plan PDF offline (`3.0.9` → `3.1.4`)

**Outcome:** Super can open **recently viewed / pinned** sheets offline; never pretend entire set is cached.

| Version | Outcome | Primary surfaces |
|---------|---------|------------------|
| **3.0.9** | Spec: cache policy (N sheets, size budget, eviction, honesty) | product-band spec |
| **3.1.0** | Cache PDF blob for sheet after online view (Cache API / IndexedDB) | `plans-specs`, `sw.js` |
| **3.1.1** | Offline sheet list: cached vs not (honest empty/disabled open) | plans-specs UI |
| **3.1.2** | Prefetch: optional “Save for offline” on active project top sheets | plans-specs + SW |
| **3.1.3** | Vitest/unit for cache key + eviction helpers | web tests |
| **3.1.4** | Checkpoint + help “Plans offline” | help + CI notes |

**Closes:** G2. Still **not** full set offline (see Deferred).

---

### Band M3 — Plan pin → draft RFI/issue (`3.1.5` → `3.2.2`)

**Outcome:** From a sheet, drop a pin + photo/note → create **draft** RFI or field issue with sheet id + location metadata; user confirms submit.

| Version | Outcome | Primary surfaces |
|---------|---------|------------------|
| **3.1.5** | Spec: pin model, permissions, no auto-submit | product-band spec |
| **3.1.6** | Viewer pin overlay (tap location → note) | plans-specs viewer |
| **3.1.7** | Create draft RFI/issue API link with `PlanSheetId` + coords/page | API + RFI client |
| **3.1.8** | Offline: queue pin draft when offline (parity with report queue pattern) | offline-store, SW |
| **3.1.9** | Deep link from site walk / field report to sheet+pin | site-walk, field report |
| **3.2.0** | Help: Pin issue on plan | help |
| **3.2.1** | Tests: pin payload + permission; no invented sheet “latest” | unit/integration |
| **3.2.2** | Checkpoint — drawing-context band | CI notes |

**Closes:** G3. Full Bluebeam-class markup remains deferred.

---

### Band M4 — Faster field log (`3.2.3` → `3.2.8`)

**Outcome:** Reduce median steps for the common “log today’s work + 1–2 photos” path without dropping truth or offline.

| Version | Outcome | Primary surfaces |
|---------|---------|------------------|
| **3.2.3** | Spec: quick-log vs full wizard (when each shows) | product-band spec |
| **3.2.4** | Quick log entry from bottom nav / site walk (same API as report) | mobile-bottom-nav, field report or slim route |
| **3.2.5** | Defaults: last project + last plan sheet memory (device-local) | field report |
| **3.2.6** | Voice → narrative still confirm-to-apply (no regression) | AI field bits |
| **3.2.7** | E2E or vitest: quick log happy path | e2e / unit |
| **3.2.8** | Checkpoint — adoption friction | CI notes |

**Closes:** G4.

---

### Band M5 — Today’s field activity glance (`3.2.9` → `3.3.2`)

**Outcome:** PM/super can open a job and see **today’s** filed reports, photos count, open issues from field—real entities only.

| Version | Outcome | Primary surfaces |
|---------|---------|------------------|
| **3.2.9** | Spec: “Today on site” data contract (no portfolio KPIs) | product-band spec |
| **3.3.0** | API: project today’s field activity slim DTO (`?view=mobile` if list) | API projects/daily-reports |
| **3.3.1** | UI card on site walk or project hub (phone) | site-walk / project hub |
| **3.3.2** | Checkpoint + help; label operational activity not “health score” | help, CI notes |

**Closes:** G5.

---

### Sequencing rationale

```
G1 offline photos  →  G2 offline sheets  →  G3 pin→RFI  →  G4 faster log  →  G5 office glance
     (habit)              (trust on site)      (context)       (adoption)       (close the loop)
```

AI (rank 6) stays **maintenance-only** in this ladder unless a later band adds assist on pins/quick-log under existing trust rules.

---

## 5. Deferred / non-goals (do not confuse with immediate gaps)

| Item | Why deferred | Source |
|------|--------------|--------|
| **Full plan markup suite** (layers, calibrated measure, Bluebeam parity) | Scope blow-up; pin→draft is the wedge | phase2 non-goals; mobile3 open question |
| **Full offline PDF cache of entire drawing set** | Size/battery/eviction risk; selected sheets first | phase2 non-goals |
| **Native app shell / Capacitor / store** | PWA-first through 3.0 program; revisit only if camera/GPS/offline exceed web | Agents.md, mobile3 native-vs-PWA |
| **Full Gantt editing on phone** | Desktop/PM work; phone = glance + filtered drill | phase3 non-goals |
| **Autonomous AI schedule/cost posts** | Trust boundary | mobile-ai-intelligence non-goals |
| **Invented subcontractor health scores / portfolio % complete on phone** | Truth-over-polish | phase3, ROLE-EXPERIENCE twin rules |
| **Re-shipping Arc A–E (2.12–2.22) or reclaiming 2.x numbers** | Already shipped; VERSION is 3.0.0 | VERSION-WORKFLOW, this doc |
| **Implementing any M1–M5 row in this analysis goal** | Analysis-only | goal non-goals |
| **Financial mobile glance (WIP/AR)** | Valid post-3.0 theme in `post-3.0-product-bands.md` but **orthogonal** to field demand stack; schedule after or parallel as separate band, not as G1–G5 | roadmap themes |

---

## 6. How to use this doc

1. Before coding a band, copy `docs/specs/product-bands/band-template.md` → `band-3.x-….md` and expand acceptance tests.  
2. Ship one version row per PR; update `VERSION`, web package, API csproj, CHANGELOG per CONTRIBUTING.  
3. Keep help + CI notes in the same PR when field flows change.  
4. Do not mark Deferred rows as “Shipped” until a later program explicitly opens them.

---

## Appendix A — Shipped baseline (do not re-plan)

| Arc / band | Through | Spec |
|------------|---------|------|
| Phase 1 field hardening | 2.13.2 | `mobile-phase1-field-hardening.md` |
| Phase 2 plans viewer | 2.14.2 | `mobile-phase2-plans-viewer.md` |
| Phase 3 site walk / schedule | 2.15.2 | `mobile-phase3-site-walk-schedule.md` |
| Mobile AI intelligence | 2.21.2 | `mobile-ai-intelligence.md` |
| Product major | **3.0.0** | root `VERSION` |
