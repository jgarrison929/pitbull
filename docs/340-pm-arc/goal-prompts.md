# Goal prompts — PM next-gen arc

> **Current product:** root `VERSION` = **`3.7.7`**.  
> **Next free stamp:** **`3.7.8`** (band 3.8 remainder — remapped CPM; see [`band-3.8-pm-cpm-practices.md`](../specs/product-bands/band-3.8-pm-cpm-practices.md)).  
> **Do not copy-paste** historical goals for `3.4.x`–`3.7.5` as “next” — those stamps are **shipped archive**.  
> Stamps **`3.7.6`** (dep-audit) and **`3.7.7`** (WIP BilledToDate) are **spent / diverted** — never reclaim for CPM.

Epic: [`docs/roadmap/pm-nextgen-3.4-to-4.0.md`](../roadmap/pm-nextgen-3.4-to-4.0.md)  
Active band: [`band-3.8-pm-cpm-practices.md`](../specs/product-bands/band-3.8-pm-cpm-practices.md)  
Band 3.5 (archive): [`band-3.5-pm-rfi-submittal-mobile.md`](../specs/product-bands/band-3.5-pm-rfi-submittal-mobile.md)

Copy-paste one `/goal` per PR. Always: full version stamp set + preflight before push.

---

## Live next goals (after remap)

### Goal → 3.7.8

```
/goal Ship Pitbull 3.7.8: band 3.8 remainder — recalculate critical path action honesty + last-run timestamp AND phone UI for recalc + last run (consolidated; 3.7.6/3.7.7 diverted). Follow docs/specs/product-bands/band-3.8-pm-cpm-practices.md row 3.7.8. Bump 3.7.7→3.7.8 + CHANGELOG. Preflight -FullWeb -DotNet. Do not reclaim 3.7.6/3.7.7.
```

### Goal → 3.7.9

```
/goal Ship Pitbull 3.7.9: band 3.8 — Help Center CPM for supers/PMs + buffer residual (consolidated). Follow band-3.8 row 3.7.9. Bump 3.7.8→3.7.9. Preflight green.
```

### Goal → 3.8.0

```
/goal Ship Pitbull 3.8.0: band 3.8 checkpoint — CI notes docs/ci/pm-3.8-cpm-notes.md; mark band Shipped through 3.8.0. Bump 3.7.9→3.8.0. Preflight + health check notes.
```

---

## Shipped archive (do not run as next)

### Goal → 3.4.1

```
/goal Ship Pitbull 3.4.1: band 3.5 open — RFI/Submittal mobile list DTO contract + band notes only (no broad feature dump). Follow docs/specs/product-bands/band-3.5-pm-rfi-submittal-mobile.md row 3.4.1. Bump 3.4.0→3.4.1 + CHANGELOG. Preflight -FullWeb -DotNet. Railway-safe stamps.
```

### Goal → 3.4.2

```
/goal Ship Pitbull 3.4.2: slim mobile RFI list API (?view=mobile or dedicated slim DTO). Band 3.5. Bump 3.4.1→3.4.2. Preflight green.
```

### Goal → 3.4.3

```
/goal Ship Pitbull 3.4.3: slim mobile Submittal list API. Band 3.5. Bump 3.4.2→3.4.3. Preflight green.
```

### Goal → 3.4.4

```
/goal Ship Pitbull 3.4.4: phone-first RFI list UI (loading/empty/error honesty). Band 3.5. Bump 3.4.3→3.4.4.
```

### Goal → 3.4.5

```
/goal Ship Pitbull 3.4.5: phone-first RFI detail + status/response capture (confirm-to-submit). Band 3.5. Bump 3.4.4→3.4.5.
```

### Goal → 3.4.6

```
/goal Ship Pitbull 3.4.6: phone-first Submittal list UI. Band 3.5. Bump 3.4.5→3.4.6.
```

### Goal → 3.4.7

```
/goal Ship Pitbull 3.4.7: phone-first Submittal detail + workflow glance (no invented register KPIs). Band 3.5. Bump 3.4.6→3.4.7.
```

### Goal → 3.4.8

```
/goal Ship Pitbull 3.4.8: Help Center cards/FAQ for mobile RFI + Submittal. Band 3.5. Bump 3.4.7→3.4.8.
```

### Goal → 3.4.9

```
/goal Ship Pitbull 3.4.9: residual honesty + unit/integration tests for mobile list DTOs only. Band 3.5 buffer. Bump 3.4.8→3.4.9.
```

### Goal → 3.5.0

```
/goal Ship Pitbull 3.5.0: band 3.5 checkpoint — CI notes docs/ci/pm-3.5-rfi-submittal-notes.md; mark band Shipped through 3.5.0. Bump 3.4.9→3.5.0. Preflight + health check notes.
```

### Goal → 3.5.1 … 3.6.0

See `band-3.6-pm-co-contracts-mobile.md` version table. Open with CO list contract; slim APIs; phone UI; help; buffer; checkpoint.

### Goal → 3.6.1 … 3.7.0

See `band-3.7-pm-schedule-gantt-kanban.md`.

### Goal → 3.7.1 … 3.7.5 (band 3.8 partial — shipped)

Shipped. See `band-3.8-pm-cpm-practices.md` rows 3.7.1–3.7.5.

### Diverted (not CPM; do not reclaim)

- **3.7.6** — dependency audit (CHANGELOG)  
- **3.7.7** — WIP BilledToDate multi-app fix (CHANGELOG)  

Remaining CPM: live goals **3.7.8 → 3.8.0** at top of this file.

Later bands (3.9+): expand stub → add prompts before first stamp of that band.
