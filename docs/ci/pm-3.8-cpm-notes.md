# CI notes — Band 3.8 CPM practices

**Status:** Partial through **3.7.5** (CPM rows); **3.7.6** / **3.7.7** diverted (dep-audit / WIP BilledToDate); free remaining **3.7.8–3.8.0**  
**Spec:** `docs/specs/product-bands/band-3.8-pm-cpm-practices.md`  
**Product VERSION:** `3.7.7` → next free **`3.7.8`** (do not reclaim 3.7.6 / 3.7.7)

## Shipped through 3.7.5

| Stamp | Evidence |
|-------|----------|
| 3.7.1 | `cpm-honesty.ts` glossary + no fake on-track |
| 3.7.2 | `criticalLabel` on schedule look-ahead |
| 3.7.3 | `formatFloatDays` null → insufficient |
| 3.7.4 | `formatDataDate` on schedule phone glance |
| 3.7.5 | `formatBaselineVarianceDays` when dates exist |

## Diverted (spent — not CPM)

| Stamp | What published instead |
|-------|------------------------|
| 3.7.6 | Dependency audit (CHANGELOG) |
| 3.7.7 | WIP BilledToDate multi-app fix (CHANGELOG) |

## Remaining (free stamps only)

| Stamp | Intent |
|-------|--------|
| **3.7.8** | Recalculate critical path confirm UI + last-run honesty **and** phone UI (consolidated from diverted 3.7.6/3.7.7 CPM intents) |
| **3.7.9** | Help CPM polish + buffer residual |
| **3.8.0** | Checkpoint + this CI notes file |

Next free: **3.7.8**.
