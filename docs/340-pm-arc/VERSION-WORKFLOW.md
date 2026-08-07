# Version workflow — PM next-gen arc (3.4.0 → 4.0.0)

**Program epic:** [`docs/roadmap/pm-nextgen-3.4-to-4.0.md`](../roadmap/pm-nextgen-3.4-to-4.0.md)  
**Current product at arc start:** `3.4.0`  
**Major end:** `4.0.0`

This file **extends** root CONTRIBUTING + historical `docs/260712/VERSION-WORKFLOW.md` for the **PM next-gen** program only. It does not reopen Arc A–E.

## Rules (locked)

1. **One version bump per PR.** Never skip numbers.  
2. **Stamp set every PR:** root `VERSION`, web `package.json`, API csproj version props, Docker ARGs (when present), `CHANGELOG.md` with ISO timestamp.  
3. **Preflight before push:** `./scripts/preflight.ps1 -FullWeb -DotNet`  
4. **Product features** live on band rows through **`3.12.0`**.  
5. **Runway `3.12.1` → `3.12.9`:** verification + deploy/CI fixes only — no new domain features.  
6. **Major:** only **`3.12.9` → `4.0.0`** for this program.  
7. Residual/buffer stamps = honesty + deploy freshness only, not feature dump.  
8. Expand stub band specs to agent-ready before that band’s first stamp.

## Ladder summary

| Segment | Range |
|---------|--------|
| Band 3.5 RFI/Submittals | `3.4.1` → `3.5.0` |
| Band 3.6 CO/Contracts | `3.5.1` → `3.6.0` |
| Band 3.7 Schedule Gantt/Kanban | `3.6.1` → `3.7.0` |
| Band 3.8 CPM | `3.7.1` → `3.8.0` |
| Band 3.9 Safety/Compliance | `3.8.1` → `3.9.0` |
| Band 3.10 Vendors/Procurement/Materials | `3.9.1` → `3.10.0` |
| Band 3.11 Pay apps/Quotes | `3.10.1` → `3.11.0` |
| Band 3.12 Hub polish | `3.11.1` → `3.12.0` |
| Runway | `3.12.1` → `3.12.9` |
| Major | `4.0.0` |

## Next stamp

**Current product:** `3.7.7` (root `VERSION`).  
**Next free stamp:** **`3.7.8`** — band 3.8 remainder (recalc honesty + phone UI, consolidated; see remapped table in `band-3.8-pm-cpm-practices.md`).

### Spent / diverted (never reclaim for CPM)

| Stamp | What actually shipped (CHANGELOG) |
|-------|-----------------------------------|
| `3.7.6` | Dependency audit (NuGet/npm) — **not** CPM recalc |
| `3.7.7` | WIP BilledToDate multi-app fix — **not** CPM phone UI |

Original band rows that named those numbers for CPM are remapped onto free **`3.7.8`–`3.8.0` only**.
