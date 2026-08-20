# CI notes — Band 3.8 CPM practices

**Status:** Partial through **3.7.5** (CPM rows); **3.7.6** / **3.7.7** / **3.7.8** diverted (dep-audit / WIP BilledToDate / Dependabot); free remaining **3.7.9–3.8.0**  
**Spec:** `docs/specs/product-bands/band-3.8-pm-cpm-practices.md`  
**Product VERSION:** `3.7.8` → next free **`3.7.9`** (do not reclaim 3.7.6 / 3.7.7 / 3.7.8)

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
| 3.7.8 | Dependabot wave (CHANGELOG) |

## Remaining (free stamps only)

| Stamp | Intent |
|-------|--------|
| **3.7.9** | Recalculate critical path confirm UI + last-run honesty **and** phone UI (consolidated from diverted 3.7.6–3.7.8 CPM intents) |
| **3.8.0** | Help CPM polish + checkpoint + this CI notes file |

Next free: **3.7.9**.
