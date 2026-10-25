# Twin overlay load / seed scale notes (2.18.0–2.18.2)

**Band:** performance / overlays (2.17.3 → 2.18.2)  
**Status:** Shipped through **2.18.2**  
**Purpose:** Document realistic seed scale for overlay fuel queries (not a production SLA claim).

## Seed scale targets (demo / integration)

| Entity | Suggested scale | Notes |
|--------|-----------------|-------|
| Projects | 1–5 active | Per tenant demo |
| Spatial zones per project | 8–40 | Site → Building → Storey → Zone |
| Open RFIs with `SpatialNodeId` | 0–50 | Unlinked RFIs → insufficient, not green |
| Progress entries with zone | 0–200 | Grouped avg % by zone |
| Schedule activities with `PrimarySpatialNodeId` | 0–100 | Critical / delay flags |

## Query pattern (no N+1)

Overlay fuel uses **batch GroupBy** loaders in parallel (`Task.WhenAll`):

- `LoadOpenRfiCountsByZoneAsync`
- `LoadProgressPercentByZoneAsync`
- `LoadScheduleSignalsByZoneAsync`

See `SpatialService.GetOverlayAsync` and unit structural check `SpatialOverlayBatchNotesTests`.

## Manual load probe (optional)

```powershell
# After ensure-seeded on a demo project, time overlays:
# GET /api/projects/{id}/spatial/overlays?mode=rfi
# Diagnostic: Debug twin_overlay_fuel elapsed_ms (2.17.5)
```

## Honesty

- Empty / insufficient zones are **not** all-clear.
- Load numbers above are **seed guidance**, not guaranteed p95 product KPIs.

## SLO evidence (2.18.1) — diagnostic, not executive KPI

| Check | Evidence | Result |
|-------|----------|--------|
| No N+1 on zone list fuel | `Task.WhenAll` + SQL `GroupBy` in `SpatialService` | Structural pass (unit: `SpatialOverlayBatchNotesTests`) |
| Overlay fuel timing logged | `OverlayPerfMetrics.FormatFuelLog` / Debug line | Diagnostic only |
| Formula regression | `overlay-formula.test.ts` + `SpatialOverlayCalculatorTests` | Unit pass |
| Cost heat honesty | cost mode Insufficient without allocation | Unit pass (`SpatialCostOverlayTests`) |
| Demo seed scale | Table above | Documented |

**Target (engineering, not marketed SLA):** for seed scale ≤40 zones + ≤50 open RFIs linked, overlay fuel batch should complete in well under 1s on local/dev Postgres.  
**Production p95:** not claimed without continuous metrics pipeline — capture `twin_overlay_fuel elapsed_ms` samples before asserting.

## Band map (2.17.3 → 2.18.2)

| Version | Deliverable |
|---------|-------------|
| 2.17.3 | Overlay batch zone fuel (parallel) |
| 2.17.4 | Storey lazy schematic |
| 2.17.5 | Fuel timing diagnostics |
| 2.17.6 | Mobile twin polish |
| 2.17.7 | Cost overlay honesty |
| 2.17.8 | Cost not-allocated banner |
| 2.17.9 | Overlay formula vitest |
| 2.18.0 | Seed scale doc |
| 2.18.1 | SLO evidence table |
| 2.18.2 | Checkpoint (this status) |

Next Arc D close-out: require spatial on progress (2.18.3+).
