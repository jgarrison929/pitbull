# Spec: Digital Twin Phase 2 implementation

**Status:** Shipped through **2.19.2** (Arc D complete)  
**Version band:** 2.15.3 → 2.19.2 (40 PRs)  
**Related:** [`pitbull-digital-twin-spec.md`](../pitbull-digital-twin-spec.md) Phase 2 (authoritative for data model); notes [`docs/ci/twin-phase2-notes.md`](../ci/twin-phase2-notes.md)

## Problem

Twin MVP (zones-first) shipped ~2.10.0; Phase 2 needs photo pins, model upload path, overlay SLO, and optional cost mode with honest labeling.

## Personas

PM (desktop admin upload), superintendent (mobile read + zone fuel), CEO glance (truthful overlays only).

## User journey

1. Field photo attached to daily report with optional GPS / zone  
2. Twin zone panel shows photo thumbs / pins  
3. Admin uploads model asset; processing state honest  
4. Overlays load within SLO; cost mode off unless allocation links  

## Primary code touchpoints

| Area | Paths |
|------|-------|
| Twin page | `src/.../projects/[id]/twin/page.tsx` |
| Spatial / twin API | search `Spatial`, `Twin`, `ModelAsset` under `src/Modules` + `src/Pitbull.Api` |
| Daily report fuel | mobile daily report + offline payload (`SpatialNodeId`, photos) |
| Feature flags | appsettings / frontend feature flags for `digitalTwin` |
| Project settings | project settings UI + schema for `RequireSpatialOnProgress` |
| Notes | `docs/ci/twin-phase2-notes.md` (create); existing `docs/ci/twin-cycle-notes.md` |

## API / data (from master twin spec)

- Photo pin aggregation by zone  
- `ModelAsset` upload + runtime pointer  
- Overlay batch queries  
- Project setting `RequireSpatialOnProgress`  
- Permissions e.g. `Spatial.Manage` for upload  

Implementers must re-read twin master §4–§7 before each sub-band.

## Version table (4 × 10 PR sub-bands)

### Band 2.15.3 → 2.16.2 — Photo pins MVP

| Version | Deliverable | Acceptance |
|---------|-------------|------------|
| 2.15.3 | Photo pin data model + API stub | Migration/entity or documented API contract; no fake green pins |
| 2.15.4 | Zone panel photo thumbnails | Zone drill shows thumbs when data exists; empty neutral |
| 2.15.5 | Pin placement from daily report photo GPS | Best-effort; honest if GPS missing |
| 2.15.6 | Overlay poll interval config | Configurable; default documented |
| 2.15.7 | Twin loading skeleton mobile | No blank white flash on phone |
| 2.15.8 | Help: twin overlays truth legend | Never “all green default” copy |
| 2.15.9 | Unit tests photo pin aggregation | Pass |
| 2.16.0 | Integration test zone + photos | Pass |
| 2.16.1 | PostHog `twin_zone_drill` timing | Diagnostic only |
| 2.16.2 | Checkpoint — photo pins MVP | Notes fragment |

### Band 2.16.3 → 2.17.2 — Model upload

| Version | Deliverable | Acceptance |
|---------|-------------|------------|
| 2.16.3 | `ModelAsset` upload API scaffold | Authz required |
| 2.16.4 | Admin upload UI (desktop) | Desktop-first; phone can show read-only status |
| 2.16.5 | Conversion job stub + “processing” state | Never claim ready while processing |
| 2.16.6 | Sample glTF/IFC seed **or** documented skip in CHANGELOG | Honest either way |
| 2.16.7 | Runtime asset version pointer | Active version selectable |
| 2.16.8 | Error + retry UX | Clear failure copy |
| 2.16.9 | Permission `Spatial.Manage` on upload | 403 without |
| 2.17.0 | Integration test upload happy path | Pass or skip with reason |
| 2.17.1 | Feature flag `features.digitalTwin` prod default | Documented |
| 2.17.2 | Checkpoint — model upload band | |

### Band 2.17.3 → 2.18.2 — Performance / overlays

| Version | Deliverable | Acceptance |
|---------|-------------|------------|
| 2.17.3 | Overlay query perf — batch zone links | No N+1 on zone list |
| 2.17.4 | Storey stream lazy load | Load on demand |
| 2.17.5 | Overlay p95 metric logging | Diagnostic logs/metrics |
| 2.17.6 | Mobile twin read-only polish | Usable 390×844 |
| 2.17.7 | Cost overlay hidden unless allocation links | No fake cost heat |
| 2.17.8 | Banner “cost by zone not allocated” | Shown when empty |
| 2.17.9 | Vitest overlay formula regression | Pass |
| 2.18.0 | Load test seed scale doc | In ci notes |
| 2.18.1 | SLO pass evidence in ci notes | Written |
| 2.18.2 | Checkpoint — performance band | |

### Band 2.18.3 → 2.19.2 — Require spatial + close Arc D

| Version | Deliverable | Acceptance |
|---------|-------------|------------|
| 2.18.3 | `RequireSpatialOnProgress` schema | Migration |
| 2.18.4 | Setting UI for PM | Desktop OK |
| 2.18.5 | Field report zone prompt when required | Cannot submit without zone if required (except demo skip) |
| 2.18.6 | Skip path for demo | Documented |
| 2.18.7 | Metric: % reports with spatial ref (labeled quality) | Not vanity KPI |
| 2.18.8 | Help: zone picker + twin | |
| 2.18.9 | E2E twin zone round-trip | Pass or flag-gated |
| 2.19.0 | Arc D integration suite tidy | |
| 2.19.1 | `docs/ci/twin-phase2-notes.md` | Complete |
| 2.19.2 | Arc D checkpoint | Spec Status shipped through 2.19.2 |

## Non-goals

- AR / native viewer  
- Portfolio % complete heatmaps without data  
- Default-green zone coloring  

## Truth rules

- Never invent green zones or portfolio % complete  
- Cost mode off or proxy-labeled per twin master §6.5 / §7  
- Insufficient data → **neutral**, not green  

## Band DoD (2.19.2)

- [x] Photo pins MVP or honest flag  
- [x] Upload path or documented skip (sample glTF skipped honestly)  
- [x] Overlay perf notes + truth banners  
- [x] RequireSpatial optional setting shipped  
- [x] Capture quality labeled metric  
- [x] Help zone picker + twin; E2E flag-gated  
- [x] `docs/ci/twin-phase2-notes.md` complete  

