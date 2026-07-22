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

After `3.7.5`: **`3.7.6`** — CPM recalculate action honesty (band 3.8 remainder; stop was intentional at 3.7.5 for prior goal).
