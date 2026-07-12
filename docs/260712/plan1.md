# Pitbull master plan — 2.12.1 → 3.0.0 (Arc A–E)

**Date:** 2026-07-12  
**Session doc:** `docs/260712/`  
**Versioning rules:** [`VERSION-WORKFLOW.md`](./VERSION-WORKFLOW.md) — **read this first; never re-negotiate in chat**  
**Execution prompts:** [`goal-prompts.md`](./goal-prompts.md) — one `/goal` per version step  
**Current version:** see root `VERSION` (program started at `2.12.1`; first ship `2.12.2`)

---

## Executive summary

Pitbull has a strong field-mobile **foundation** (bottom nav, `/daily-reports/mobile`, PWA/offline, site walk, twin MVP) but is **not production-ready** for the mobile3 “I gotta have this” bar until offline sync parity, mobile chrome, E2E, help, and performance discipline land.

**3.0.0 definition (locked):** Arc **A–E** product only (~101 PRs: `2.12.2` → `2.22.2`) + **20-PR runway** (`2.22.3` → `2.24.2`) + major stamp. **≈122 PRs total.**

**Out of 3.0.0 scope:** Product band G expansion (old 2.23→2.97 themes) — parked in [`docs/roadmap/post-3.0-product-bands.md`](../roadmap/post-3.0-product-bands.md).

**Agent workflow:** Every feature has a spec; every user-visible ship updates help; every PR bumps exactly one version.

---

## Mobile platform decision (locked through 3.0.0)

**Chosen:** PWA-first. Native iOS/Android or Capacitor shell is **post-3.0.0** only if decision gates fire.

### Why web is still the right bet for 3.0.0

Construction ERPs generate huge transaction volume — but **phones should not crunch ledgers**. Slowness usually comes from:

- Over-fetching APIs (fix: slim mobile DTOs, pagination)
- N+1 aggregation (fix: batch queries — e.g. 2.12.1 role summary)
- Rendering thousands of DOM rows (fix: virtualization)

Native apps do not fix a 5MB JSON response. Field mobile should be **capture + glance + drill to filtered lists**.

### Revisit native / Capacitor when (post-3.0.0)

- Offline sync failure rate > 2% on field uploads
- Median field report > 120s after UX fixes
- Push notifications become hard adoption requirement
- iOS PWA install rate < 20% of field sessions

---

## Current state (2026-07-12)

| Area | Status |
|------|--------|
| Version | see root `VERSION` |
| Open PRs | None |
| Recent ships | Twin 2.8.4–2.10.0, Role UX 2.11–2.12, perf/403/twin discoverability |
| Mobile gaps | SW sync thin payload, double bottom bars risk, no mobile E2E, outdated help FAQ (“fully responsive”) |
| Specs | Arc A–E skeletons → **agent-hardened** in 2.12.2 program; G bands post-3.0 |
| CI | Role E2E smoke; mobile field-report + owner-signup not fully gated yet (Arc E) |

---

## Performance architecture (required on every arc)

```text
Mobile client                API                         Data
─────────────                ───                         ────
Capture flows only    →      Slim DTOs / ?view=mobile    Indexes
Summary cards         →      Batch aggregates            Rollups
Virtual lists (≤50)   →      Cursor pagination           PostgreSQL
```

**Agent rule:** No client-side job-cost or portfolio aggregation on phone.

---

## Version arcs (linear to 3.0.0)

Each arc checkpoint ends at `.2` where practical. One PR = one version bump.

### Arc A — Foundation & mobile Phase 1 (2.12.2 → 2.13.2) ← **current**

| Ver | Deliverable |
|-----|-------------|
| 2.12.2 | Spec program firm-up + `AGENTS.md` + PR template + version stamp |
| 2.12.3 | Field report bottom-bar vs `MobileBottomNav`; PWA prompt safe-area; SW precache `/daily-reports/mobile` |
| 2.12.4 | Offline sync parity: `sw.js` payload = `use-online-status.ts` full daily report |
| 2.12.5 | Playwright mobile project + `mobile-field-report.spec.ts` scaffold |
| 2.12.6 | Superintendent E2E: minimal field report completes at 390×844 |
| 2.12.7 | Help: “Field & mobile workflows” section |
| 2.12.8 | Help: PWA install + bottom nav FAQ; replace “fully responsive” copy |
| 2.12.9 | PostHog: extend `field_report_submitted` funnel + `viewport_class` |
| 2.13.0 | List virtualization on one high-traffic mobile list |
| 2.13.1 | Slim mobile API payload for one endpoint |
| 2.13.2 | Arc A acceptance + `docs/ci/mobile-phase1-notes.md` |

### Arc B — Plans integration (2.13.3 → 2.14.2)

| Ver | Theme |
|-----|-------|
| 2.13.3 | Spec finalize / wireframe note in `mobile-phase2-plans-viewer.md` |
| 2.13.4 | Field-only plans viewer; hide admin CRUD on phone |
| 2.13.5 | PDF touch targets + sheet search mobile layout |
| 2.13.6 | Deep link site walk → plans with sheet filter |
| 2.13.7 | Plan revision label on viewer |
| 2.13.8 | Help: Plans on site |
| 2.13.9 | Vitest plans mobile layout |
| 2.14.0 | `PlanSheetId` picker on field report |
| 2.14.1 | SW cache plan metadata for active project |
| 2.14.2 | Arc B checkpoint + notes |

### Arc C — Site walk & schedule (2.14.3 → 2.15.2)

Unified site walk entry, schedule mobile cards → progress bridge, sub status tap actions. Spec: `mobile-phase3-site-walk-schedule.md`.

### Arc D — Twin Phase 2 (2.15.3 → 2.19.2)

Photo pins, overlay SLO, model upload happy path, `RequireSpatialOnProgress`. Spec: `digital-twin-phase2-implementation.md` (4 sub-bands of 10). Master: `pitbull-digital-twin-spec.md`.

### Arc E — Intelligence & office help (2.19.3 → 2.22.2)

Mobile AI voice MVP, photo assist (labeled), workflow approvals Phase 2, KPI drill contracts, office help, CI mobile+owner smoke. Specs under `docs/specs/`.

### Release checklist runway (2.22.3 → 2.24.2) — **not product**

**20 PRs** — verification and fixes only. See [`release-checklist-runway.md`](./release-checklist-runway.md). **No new features.**

**Major:** `2.24.2 → 3.0.0` after all checklist items pass.

---

## 3.0.0 release checklist

1. Mobile3 Phases 1–3 acceptance per specs + E2E evidence  
2. Twin Phase 2 core shipped or feature-flagged with honest CHANGELOG  
3. Help center covers field + PM + executive workflows  
4. Every shipped Arc A–E feature has `docs/specs/*` with `Status: Shipped through 2.22.2`  
5. CI runs mobile + owner-signup smoke  
6. Performance: paginated mobile lists, batched summaries, no client ledger aggregation  
7. Truth rules intact (AGENTS.md, twin spec §7)

---

## Subagent team (leader orchestrates)

| Agent | Owns |
|-------|------|
| **Lead** | Version slot, scope cuts, merge order |
| **Mobile UX** | `daily-reports/mobile`, `mobile-bottom-nav`, `sw.js`, `project-sub-nav` |
| **Backend/Sync** | `use-online-status.ts`, offline store, slim DTOs |
| **Docs/Spec/Help** | `docs/specs/`, `help/page.tsx`, `AGENTS.md` |
| **QA/CI** | Playwright, vitest, `preflight.ps1`, `.github/workflows/ci.yml` |

Handoff: Spec → implement → perf check → test → preflight → one version bump → PR.

---

## Session map (realistic)

| Horizon | Target |
|---------|--------|
| Session 1 | Phase 0 docs + ship **2.12.2**; ideally 2.12.3–2.12.6 |
| Later sessions | Continue one `/goal` per version through Arc E |
| Final sessions | Runway 2.22.3 → 2.24.2 → **3.0.0** |

Do **not** batch version bumps. Do **not** claim 3.0.0 until runway checklist is green.

---

## Related docs

- [`docs/mobile3.md`](../mobile3.md) — field product vision  
- [`docs/pitbull-digital-twin-spec.md`](../pitbull-digital-twin-spec.md) — twin implementable spec  
- [`docs/ROLE-EXPERIENCE.md`](../ROLE-EXPERIENCE.md) — persona UX contract  
- [`docs/WORKFLOW-EVALUATION-MATRIX.md`](../WORKFLOW-EVALUATION-MATRIX.md) — lifecycle acceptance  
- [`AGENTS.md`](../../AGENTS.md) — agent instructions  
- [`spec-workload.md`](./spec-workload.md) — full spec index  
- [`release-checklist-runway.md`](./release-checklist-runway.md) — 2.22.3→3.0.0 runway  
- [`docs/roadmap/post-3.0-product-bands.md`](../roadmap/post-3.0-product-bands.md) — after major  
