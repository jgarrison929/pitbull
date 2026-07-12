# /goal prompts — version by version (Arc A–E → 3.0.0)

**How to use:** Paste **one** block into Grok Build / Composer / Claude / Codex as a `/goal`.  
**Rules:** Read [`VERSION-WORKFLOW.md`](./VERSION-WORKFLOW.md) first. Ship **one** version step. One clean PR. Run `preflight.ps1` before push.

**Starting point after 2.12.2 ships:** `2.12.2` on `main`  
**Next goal:** `2.12.3` (mobile chrome)  
**Product ends:** `2.22.2`  
**Runway:** `2.22.3` → `2.24.2`  
**Major:** `2.24.2` → `3.0.0`

---

## Shared exit (every goal)

```text
Bump VERSION + package.json + Pitbull.Api.csproj Version props + Docker ARGs if used.
CHANGELOG ## [x.y.z] - ISO-8601-with-offset.
./scripts/preflight.ps1 -FullWeb -DotNet green.
Single clean PR; CI green; check off the version row in the band spec.
```

---

## Arc A — 2.12.2 → 2.13.2

### Goal → 2.12.2 (spec + agent infrastructure)

```text
/goal Ship Pitbull 2.12.2: agent and spec infrastructure (Arc A–E firm path to 3.0.0).

Read first: docs/260712/VERSION-WORKFLOW.md, docs/260712/plan1.md, CONTRIBUTING.md, AGENTS.md.

Deliverables (docs may already exist from Phase 0 — complete any gaps, then stamp):
1. docs/specs/README.md — agent-ready template + checklist
2. Arc A–E specs hardened under docs/specs/ (mobile-phase1… through ci-mobile-owner-smoke)
3. docs/260712/* re-laddered: product ends 2.22.2; runway 2.22.3→2.24.2; major 2.24.2→3.0.0
4. Expand AGENTS.md — required reading by task type; mobile perf rule; session table with ~122 PR path
5. Upgrade .github/pull_request_template.md — spec link, version checklist, preflight, help if user-visible
6. docs/roadmap/post-3.0-product-bands.md — G themes parked
7. Bump VERSION 2.12.1 → 2.12.2 + CHANGELOG ISO header

Do NOT implement mobile chrome or sync fixes in this PR — infrastructure only.

Exit: preflight green; single PR; CI passes.
```

### Goal → 2.12.3 (mobile chrome)

```text
/goal Ship Pitbull 2.12.3: mobile chrome fixes for field report.

Read: docs/specs/mobile-phase1-field-hardening.md §2.12.3, VERSION-WORKFLOW.md.

Implement:
1. Resolve double fixed bottom bars on daily-reports/mobile vs MobileBottomNav (MOBILE_MAIN_BOTTOM_CLEARANCE or hide nav on wizard)
2. Reposition pwa-install-prompt above bottom nav safe area
3. Add /daily-reports/mobile to public/sw.js precache shell
4. Vitest for clearance constants if applicable
5. Bump 2.12.2 → 2.12.3 + CHANGELOG

Exit: Manual 390×844 — no overlapping fixed bars; preflight; single PR.
```

### Goal → 2.12.4 (offline sync parity)

```text
/goal Ship Pitbull 2.12.4: offline daily-report sync payload parity.

Read: docs/specs/mobile-phase1-field-hardening.md §2.12.4.

Problem: sw.js omits FieldActivities, TruckConditions, SpatialNodeId, PlanSheetId that use-online-status.ts syncDailyReport sends.

Implement:
1. Align sw.js daily-report body with client syncDailyReport (shared helper if feasible)
2. Extend offline-store.test.ts — activities + spatial survive SW-shaped replay
3. Bump 2.12.3 → 2.12.4 + CHANGELOG

Scope: daily-report path only.

Exit: unit tests pass; preflight; single PR.
```

### Goal → 2.12.5 (mobile E2E scaffold)

```text
/goal Ship Pitbull 2.12.5: Playwright mobile field-report scaffold.

Read: docs/specs/mobile-phase1-field-hardening.md §2.12.5, e2e/fixtures/ROLE-PERSONA-MAP.md.

Implement:
1. e2e/tests/mobile-field-report.spec.ts — superintendent demo login + 390×844
2. Optional mobile project in playwright config
3. May skip full flow until 2.12.6 — document in spec
4. Bump 2.12.4 → 2.12.5 + CHANGELOG

Exit: playwright scaffold runs; preflight; single PR.
```

### Goal → 2.12.6 (mobile E2E complete)

```text
/goal Ship Pitbull 2.12.6: mobile field report E2E passes end-to-end.

Read: docs/specs/mobile-phase1-field-hardening.md §2.12.6.

Implement:
1. Complete mobile-field-report.spec.ts — superintendent minimal 4-step report
2. Demo seed project; assert success toast or API 201
3. Bump 2.12.5 → 2.12.6 + CHANGELOG

Exit: e2e passes locally; role smoke still green; single PR.
```

### Goal → 2.12.7 (field help — workflows)

```text
/goal Ship Pitbull 2.12.7: Help Center field workflow section.

Read: docs/specs/help-center-field-workflows.md.

Implement in help/page.tsx:
1. Section "Field & mobile workflows": Daily Field Report, Site Walk, Offline/PWA cards
2. Each: 3–5 steps + real deep link
3. Bump 2.12.6 → 2.12.7 + CHANGELOG

Exit: help renders section; preflight; single PR.
```

### Goal → 2.12.8 (field help — FAQ)

```text
/goal Ship Pitbull 2.12.8: Help Center mobile FAQ accuracy.

Read: docs/specs/help-center-field-workflows.md §2.12.8.

Implement:
1. Replace "fully responsive" mobile FAQ with accurate paths
2. FAQ: offline queue, bottom nav, PWA install
3. Twin + Plans cards if missing
4. Bump 2.12.7 → 2.12.8 + CHANGELOG

Exit: no misleading mobile copy; single PR.
```

### Goal → 2.12.9 (PostHog mobile funnels)

```text
/goal Ship Pitbull 2.12.9: PostHog mobile field funnel events.

Read: docs/specs/mobile-phase1-field-hardening.md §Analytics; extend existing field_report_submitted.

Implement:
1. viewport_class on field report submit/step events
2. Do not invent conflicting event names without migration note
3. Document in spec
4. Bump 2.12.8 → 2.12.9 + CHANGELOG

Exit: vitest if helpers extracted; preflight; single PR.
```

### Goal → 2.13.0 (list virtualization)

```text
/goal Ship Pitbull 2.13.0: virtualized list on one mobile-heavy surface.

Read: plan1.md Performance architecture; mobile-phase1 §2.13.0.

Implement:
1. TanStack Virtual (or existing) on ONE list: time-tracking mobile OR project RFIs
2. Server pagination unchanged
3. Spec note §Performance
4. Bump 2.12.9 → 2.13.0 + CHANGELOG

Exit: scroll OK with large list; single PR.
```

### Goal → 2.13.1 (slim mobile API)

```text
/goal Ship Pitbull 2.13.1: slim mobile API payload for one endpoint.

Read: mobile-phase1 §2.13.1.

Implement:
1. ?view=mobile or dedicated DTO for ONE high-traffic list endpoint (name it in CHANGELOG)
2. Frontend consumes slim shape on phone only
3. Test: payload smaller vs default
4. Bump 2.13.0 → 2.13.1 + CHANGELOG

Exit: no desktop break; single PR.
```

### Goal → 2.13.2 (Arc A checkpoint)

```text
/goal Ship Pitbull 2.13.2: Arc A acceptance — mobile Phase 1 complete.

Read: docs/specs/mobile-phase1-field-hardening.md Band DoD.

Deliverables:
1. docs/ci/mobile-phase1-notes.md
2. Mark spec Status: Shipped through 2.13.2
3. P0 gaps only if <30 lines each
4. Bump 2.13.1 → 2.13.2 + CHANGELOG summarizing Arc A

Exit: acceptance checked; preflight; single PR.
```

---

## Arc B — 2.13.3 → 2.14.2

Read always: `docs/specs/mobile-phase2-plans-viewer.md`, `docs/mobile3.md` Phase 2.

### Goal → 2.13.3

```text
/goal Ship Pitbull 2.13.3: finalize plans field-mode spec notes.

Read: mobile-phase2-plans-viewer.md.
Add field-mode wireframe notes (viewer default <lg; admin CRUD desktop).
Bump 2.13.2 → 2.13.3 + CHANGELOG.
Exit: spec row checked; preflight; single PR.
```

### Goal → 2.13.4

```text
/goal Ship Pitbull 2.13.4: field-only plans viewer; hide admin CRUD on phone.

Implement on projects/[id]/plans-specs: mobile viewer-first; admin actions lg+ only.
Bump 2.13.3 → 2.13.4 + CHANGELOG.
Exit: 390×844 usable; single PR.
```

### Goal → 2.13.5

```text
/goal Ship Pitbull 2.13.5: PDF touch targets + mobile sheet search.

Min 44px controls; one-handed search layout on plans-specs.
Bump 2.13.4 → 2.13.5 + CHANGELOG.
Exit: manual mobile check; single PR.
```

### Goal → 2.13.6

```text
/goal Ship Pitbull 2.13.6: site walk deep link → plans with sheet filter.

From site-walk to plans-specs with query filter.
Bump 2.13.5 → 2.13.6 + CHANGELOG.
Exit: link works; single PR.
```

### Goal → 2.13.7

```text
/goal Ship Pitbull 2.13.7: plan revision label on viewer.

Show Rev N from API — no invented "latest".
Bump 2.13.6 → 2.13.7 + CHANGELOG.
Exit: single PR.
```

### Goal → 2.13.8

```text
/goal Ship Pitbull 2.13.8: Help — Plans on site workflow card.

Update help/page.tsx; real deep link.
Bump 2.13.7 → 2.13.8 + CHANGELOG.
Exit: single PR.
```

### Goal → 2.13.9

```text
/goal Ship Pitbull 2.13.9: Vitest plans-specs mobile layout helpers.

Add/extend unit tests near plans components.
Bump 2.13.8 → 2.13.9 + CHANGELOG.
Exit: vitest green; single PR.
```

### Goal → 2.14.0

```text
/goal Ship Pitbull 2.14.0: PlanSheetId picker on field report.

Optional picker on daily-reports/mobile; include in online + offline payload.
Bump 2.13.9 → 2.14.0 + CHANGELOG.
Exit: offline test covers PlanSheetId; single PR.
```

### Goal → 2.14.1

```text
/goal Ship Pitbull 2.14.1: SW cache plan metadata for active project.

Cache keys documented; honest empty if uncached.
Bump 2.14.0 → 2.14.1 + CHANGELOG.
Exit: single PR.
```

### Goal → 2.14.2

```text
/goal Ship Pitbull 2.14.2: Arc B checkpoint.

docs/ci/mobile-phase2-notes.md; mark mobile-phase2 Status Shipped through 2.14.2.
Bump 2.14.1 → 2.14.2 + CHANGELOG.
Exit: preflight; single PR.
```

---

## Arc C — 2.14.3 → 2.15.2

Read always: `docs/specs/mobile-phase3-site-walk-schedule.md`.

### Goal → 2.14.3

```text
/goal Ship Pitbull 2.14.3: unified site walk entry banner ("Today on this job").
Link to site-walk from field/PM home or project hub. Bump 2.14.2→2.14.3. Exit: preflight; single PR.
```

### Goal → 2.14.4

```text
/goal Ship Pitbull 2.14.4: schedule status tap → progress draft (activity preselect).
Bump 2.14.3→2.14.4. Exit: preflight; single PR.
```

### Goal → 2.14.5

```text
/goal Ship Pitbull 2.14.5: critical-path filter on mobile schedule cards.
Bump 2.14.4→2.14.5. Exit: preflight; single PR.
```

### Goal → 2.14.6

```text
/goal Ship Pitbull 2.14.6: sub status tap → RFIs for sub (real filters; no fake health scores).
Bump 2.14.5→2.14.6. Exit: preflight; single PR.
```

### Goal → 2.14.7

```text
/goal Ship Pitbull 2.14.7: site walk → twin link when digitalTwin flag on; hidden when off.
Bump 2.14.6→2.14.7. Exit: preflight; single PR.
```

### Goal → 2.14.8

```text
/goal Ship Pitbull 2.14.8: Help site walk workflow card.
Bump 2.14.7→2.14.8. Exit: preflight; single PR.
```

### Goal → 2.14.9

```text
/goal Ship Pitbull 2.14.9: PostHog site_walk_started (projectId + viewport_class).
Bump 2.14.8→2.14.9. Exit: preflight; single PR.
```

### Goal → 2.15.0

```text
/goal Ship Pitbull 2.15.0: deep link schedule activity from field report (optional field/query).
Bump 2.14.9→2.15.0. Exit: preflight; single PR.
```

### Goal → 2.15.1

```text
/goal Ship Pitbull 2.15.1: mobile schedule empty states with honest copy.
Bump 2.15.0→2.15.1. Exit: preflight; single PR.
```

### Goal → 2.15.2

```text
/goal Ship Pitbull 2.15.2: Arc C checkpoint + docs/ci/mobile-phase3-notes.md; mark phase3 shipped.
Bump 2.15.1→2.15.2. Exit: preflight; single PR.
```

---

## Arc D — Twin Phase 2 (2.15.3 → 2.19.2)

Read always: `docs/specs/digital-twin-phase2-implementation.md` + `docs/pitbull-digital-twin-spec.md` §4–§7.  
**Compact form:** implement only the version row; truth rules mandatory.

### 2.15.3 → 2.16.2 (photo pins)

```text
/goal Ship Pitbull 2.15.3: photo pin data model + API stub (no fake green pins). Bump 2.15.2→2.15.3.
/goal Ship Pitbull 2.15.4: zone panel photo thumbnails; empty neutral. Bump 2.15.3→2.15.4.
/goal Ship Pitbull 2.15.5: pin placement from daily report photo GPS (honest if missing). Bump 2.15.4→2.15.5.
/goal Ship Pitbull 2.15.6: overlay poll interval config. Bump 2.15.5→2.15.6.
/goal Ship Pitbull 2.15.7: twin loading skeleton mobile. Bump 2.15.6→2.15.7.
/goal Ship Pitbull 2.15.8: Help twin overlays truth legend. Bump 2.15.7→2.15.8.
/goal Ship Pitbull 2.15.9: unit tests photo pin aggregation. Bump 2.15.8→2.15.9.
/goal Ship Pitbull 2.16.0: integration test zone + photos. Bump 2.15.9→2.16.0.
/goal Ship Pitbull 2.16.1: PostHog twin_zone_drill timing. Bump 2.16.0→2.16.1.
/goal Ship Pitbull 2.16.2: photo pins MVP checkpoint. Bump 2.16.1→2.16.2.
```

### 2.16.3 → 2.17.2 (model upload)

```text
/goal Ship Pitbull 2.16.3: ModelAsset upload API scaffold + authz. Bump 2.16.2→2.16.3.
/goal Ship Pitbull 2.16.4: admin upload UI desktop. Bump 2.16.3→2.16.4.
/goal Ship Pitbull 2.16.5: conversion job stub + processing state (never claim ready early). Bump 2.16.4→2.16.5.
/goal Ship Pitbull 2.16.6: sample glTF/IFC seed OR documented CHANGELOG skip. Bump 2.16.5→2.16.6.
/goal Ship Pitbull 2.16.7: runtime asset version pointer. Bump 2.16.6→2.16.7.
/goal Ship Pitbull 2.16.8: error + retry UX. Bump 2.16.7→2.16.8.
/goal Ship Pitbull 2.16.9: Spatial.Manage permission on upload. Bump 2.16.8→2.16.9.
/goal Ship Pitbull 2.17.0: integration test upload happy path. Bump 2.16.9→2.17.0.
/goal Ship Pitbull 2.17.1: feature flag features.digitalTwin prod default documented. Bump 2.17.0→2.17.1.
/goal Ship Pitbull 2.17.2: model upload band checkpoint. Bump 2.17.1→2.17.2.
```

### 2.17.3 → 2.18.2 (perf / overlays)

```text
/goal Ship Pitbull 2.17.3: overlay query batch zone links (no N+1). Bump 2.17.2→2.17.3.
/goal Ship Pitbull 2.17.4: storey stream lazy load. Bump 2.17.3→2.17.4.
/goal Ship Pitbull 2.17.5: overlay p95 metric logging. Bump 2.17.4→2.17.5.
/goal Ship Pitbull 2.17.6: mobile twin read-only polish 390×844. Bump 2.17.5→2.17.6.
/goal Ship Pitbull 2.17.7: cost overlay hidden unless allocation links. Bump 2.17.6→2.17.7.
/goal Ship Pitbull 2.17.8: banner cost by zone not allocated. Bump 2.17.7→2.17.8.
/goal Ship Pitbull 2.17.9: vitest overlay formula regression. Bump 2.17.8→2.17.9.
/goal Ship Pitbull 2.18.0: load test seed scale doc in ci notes. Bump 2.17.9→2.18.0.
/goal Ship Pitbull 2.18.1: SLO pass evidence in ci notes. Bump 2.18.0→2.18.1.
/goal Ship Pitbull 2.18.2: performance band checkpoint. Bump 2.18.1→2.18.2.
```

### 2.18.3 → 2.19.2 (require spatial + close)

```text
/goal Ship Pitbull 2.18.3: RequireSpatialOnProgress schema migration. Bump 2.18.2→2.18.3.
/goal Ship Pitbull 2.18.4: PM setting UI for RequireSpatialOnProgress. Bump 2.18.3→2.18.4.
/goal Ship Pitbull 2.18.5: field report zone prompt when required. Bump 2.18.4→2.18.5.
/goal Ship Pitbull 2.18.6: demo skip path documented. Bump 2.18.5→2.18.6.
/goal Ship Pitbull 2.18.7: % reports with spatial ref metric (labeled quality). Bump 2.18.6→2.18.7.
/goal Ship Pitbull 2.18.8: Help zone picker + twin. Bump 2.18.7→2.18.8.
/goal Ship Pitbull 2.18.9: E2E twin zone round-trip (or flag-gated). Bump 2.18.8→2.18.9.
/goal Ship Pitbull 2.19.0: Arc D integration suite tidy. Bump 2.18.9→2.19.0.
/goal Ship Pitbull 2.19.1: docs/ci/twin-phase2-notes.md complete. Bump 2.19.0→2.19.1.
/goal Ship Pitbull 2.19.2: Arc D checkpoint; digital-twin-phase2 Status Shipped through 2.19.2. Bump 2.19.1→2.19.2.
```

**Each Arc D goal also:** Read twin truth rules; CHANGELOG honest; preflight; single PR.

---

## Arc E — 2.19.3 → 2.22.2

### AI (2.19.3 → 2.21.2) — read `mobile-ai-intelligence.md`

```text
/goal Ship Pitbull 2.19.3: AI voice endpoint scaffold (existing provider). Bump 2.19.2→2.19.3.
/goal Ship Pitbull 2.19.4: construction jargon prompt → structured narratives. Bump 2.19.3→2.19.4.
/goal Ship Pitbull 2.19.5: field report Apply AI suggestion chip (user confirm). Bump 2.19.4→2.19.5.
/goal Ship Pitbull 2.19.6: AI usage tracking per company. Bump 2.19.5→2.19.6.
/goal Ship Pitbull 2.19.7: photo assist optional safety suggestion (labeled). Bump 2.19.6→2.19.7.
/goal Ship Pitbull 2.19.8: UI label Suggestion — review before submit. Bump 2.19.7→2.19.8.
/goal Ship Pitbull 2.19.9: offline AI disabled honest copy. Bump 2.19.8→2.19.9.
/goal Ship Pitbull 2.20.0: end-of-day field summary rule-based. Bump 2.19.9→2.20.0.
/goal Ship Pitbull 2.20.1: optional LLM summary behind flag. Bump 2.20.0→2.20.1.
/goal Ship Pitbull 2.20.2: AI MVP core checkpoint. Bump 2.20.1→2.20.2.
/goal Ship Pitbull 2.20.3: risk flag schedule slip proxy labeled. Bump 2.20.2→2.20.3.
/goal Ship Pitbull 2.20.4: PostHog ai_suggestion_applied. Bump 2.20.3→2.20.4.
/goal Ship Pitbull 2.20.5: Help AI on mobile FAQ. Bump 2.20.4→2.20.5.
/goal Ship Pitbull 2.20.6: unit tests prompt sanitization. Bump 2.20.5→2.20.6.
/goal Ship Pitbull 2.20.7: rate limit demo users. Bump 2.20.6→2.20.7.
/goal Ship Pitbull 2.20.8: error boundary AI panel. Bump 2.20.7→2.20.8.
/goal Ship Pitbull 2.20.9: integration test mock provider. Bump 2.20.8→2.20.9.
/goal Ship Pitbull 2.21.0: vitest voice + AI merge. Bump 2.20.9→2.21.0.
/goal Ship Pitbull 2.21.1: AI trust boundary docs addendum. Bump 2.21.0→2.21.1.
/goal Ship Pitbull 2.21.2: intelligence band checkpoint; mobile-ai Status Shipped through 2.21.2. Bump 2.21.1→2.21.2.
```

### Workflow + CI subset (2.21.3 → 2.22.0)

```text
/goal Ship Pitbull 2.21.3: freeze approvals lifecycle expansion in workflow-approvals-phase2.md. Bump 2.21.2→2.21.3.
/goal Ship Pitbull 2.21.4: GET pending approvals aggregate (real DB counts, RLS). Bump 2.21.3→2.21.4.
/goal Ship Pitbull 2.21.5: CI job scaffold mobile-smoke (continue-on-error OK). Bump 2.21.4→2.21.5.
/goal Ship Pitbull 2.21.6: owner-signup.spec.ts in CI + PM home pending approvals card. Bump 2.21.5→2.21.6.
/goal Ship Pitbull 2.21.7: mobile-field-report in CI + mobile approve/reject one lifecycle. Bump 2.21.6→2.21.7.
/goal Ship Pitbull 2.21.8: mirror workflow-transitions + integration approval test. Bump 2.21.7→2.21.8.
/goal Ship Pitbull 2.21.9: Help approvals workflow. Bump 2.21.8→2.21.9.
/goal Ship Pitbull 2.22.0: workflow Phase 2 checkpoint; Status Shipped through 2.22.0. Bump 2.21.9→2.22.0.
```

### KPI + office help + CI harden (2.22.1 → 2.22.2) — **last product PRs**

```text
/goal Ship Pitbull 2.22.1: KPI drill audit matrix (role-kpi-drill-contracts) + office help cards (CEO/CFO/PM/Estimator).
Read: role-kpi-drill-contracts.md, help-center-office-workflows.md, ROLE-EXPERIENCE.md.
Bump 2.22.0→2.22.1 + CHANGELOG.
Exit: matrix filled; help cards live; preflight; single PR.

/goal Ship Pitbull 2.22.2: LAST PRODUCT PR — fix orphan KPIs + vitest matrix; office FAQ; CI required checks notes.
Read: role-kpi-drill-contracts §2.22.2, help-center-office-workflows, ci-mobile-owner-smoke.
Mark Arc E specs Shipped through 2.22.2 where complete; honest partial flags only with CHANGELOG.
Bump 2.22.1→2.22.2 + CHANGELOG (product complete).
Exit: preflight; single PR. Next goal is runway 2.22.3 — NO new features after this.
```

---

## Runway — 2.22.3 → 3.0.0

Read: [`release-checklist-runway.md`](./release-checklist-runway.md). **Fixes and verification only.**

```text
/goal Ship Pitbull 2.22.3: runway opens — snapshot checklist; fix P0 regressions from 2.22.2. Bump 2.22.2→2.22.3.
/goal Ship Pitbull 2.22.4: checklist §1 mobile E2E + spec sign-off evidence. Bump 2.22.3→2.22.4.
/goal Ship Pitbull 2.22.5: checklist §2 twin Phase 2 flags + copy audit. Bump 2.22.4→2.22.5.
/goal Ship Pitbull 2.22.6: checklist §3 help walkthrough all personas. Bump 2.22.5→2.22.6.
/goal Ship Pitbull 2.22.7: checklist §4 spec-workload audit all A–E Shipped. Bump 2.22.6→2.22.7.
/goal Ship Pitbull 2.22.8: checklist §5 CI jobs green / document. Bump 2.22.7→2.22.8.
/goal Ship Pitbull 2.22.9: checklist §6 perf spot-check. Bump 2.22.8→2.22.9.
/goal Ship Pitbull 2.23.0: checklist §7 truth rules review. Bump 2.22.9→2.23.0.
/goal Ship Pitbull 2.23.1: buffer fixes from audit only. Bump 2.23.0→2.23.1.
/goal Ship Pitbull 2.23.2: buffer fixes only. Bump 2.23.1→2.23.2.
/goal Ship Pitbull 2.23.3: buffer fixes only. Bump 2.23.2→2.23.3.
/goal Ship Pitbull 2.23.4: demo seed parity spot-check. Bump 2.23.3→2.23.4.
/goal Ship Pitbull 2.23.5: role E2E local full pass notes. Bump 2.23.4→2.23.5.
/goal Ship Pitbull 2.23.6: CHANGELOG narrative draft for 3.0.0. Bump 2.23.5→2.23.6.
/goal Ship Pitbull 2.23.7: ARCHITECTURE / ROLE-EXPERIENCE drift check. Bump 2.23.6→2.23.7.
/goal Ship Pitbull 2.23.8: remaining P1 fixes only. Bump 2.23.7→2.23.8.
/goal Ship Pitbull 2.23.9: remaining P1 fixes only. Bump 2.23.8→2.23.9.
/goal Ship Pitbull 2.24.0: preflight FullWeb+DotNet + deploy smoke on demo. Bump 2.23.9→2.24.0.
/goal Ship Pitbull 2.24.1: final fix buffer. Bump 2.24.0→2.24.1.
/goal Ship Pitbull 2.24.2: RELEASE CANDIDATE — all release-checklist boxes checked. Bump 2.24.1→2.24.2.
```

### Goal → 3.0.0 (major — only after 2.24.2)

```text
/goal Ship Pitbull 3.0.0: major release.

Prerequisite: VERSION on main is 2.24.2; all items in docs/260712/release-checklist-runway.md checked.

Bump 2.24.2 → 3.0.0 (VERSION, package.json, Api csproj, Docker ARGs).
CHANGELOG major section summarizing Arc A–E + runway.
Exit: full preflight; single major PR.
```

---

## Quick reference

```text
Current VERSION:  cat VERSION
Next goal:        first open step after VERSION in this file
Workflow rules:   docs/260712/VERSION-WORKFLOW.md
Master plan:      docs/260712/plan1.md
Specs index:      docs/260712/spec-workload.md
Preflight:        ./scripts/preflight.ps1 -FullWeb -DotNet
Product stop:     2.22.2
Major:            2.24.2 → 3.0.0
```
