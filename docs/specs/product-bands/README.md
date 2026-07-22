# Product band specs

**Active program:** **PM next-gen arc** `3.4.0` → `4.0.0`  
**Epic (source of truth):** [`docs/roadmap/pm-nextgen-3.4-to-4.0.md`](../../roadmap/pm-nextgen-3.4-to-4.0.md)  
**Research (workflows + mobile complaints):** [`docs/roadmap/pm-mobile-workflows-and-complaints-2026.md`](../../roadmap/pm-mobile-workflows-and-complaints-2026.md)  
**Program folder:** [`docs/340-pm-arc/`](../../340-pm-arc/)  

Historical **3.0.0** Arc A–E is complete (`docs/260712/`). Do not reopen 2.x numbers.

## Production rules

1. Write/expand the band spec to **agent-ready** before implementing that band.  
2. One VERSION stamp per PR; never skip (`docs/340-pm-arc/VERSION-WORKFLOW.md`).  
3. Stay one band ahead of current VERSION when expanding stubs.  
4. Railway gates: [`docs/ci/pm-arc-deploy-safety.md`](../../ci/pm-arc-deploy-safety.md).  
5. Truth over polish; no invented KPIs; phone = capture + glance + filtered drill.

## PM next-gen ladder (3.4 → 4.0)

| Band | Versions | Spec | Status |
|------|----------|------|--------|
| **3.5** RFI + Submittal mobile | `3.4.1` → `3.5.0` | [band-3.5-pm-rfi-submittal-mobile.md](./band-3.5-pm-rfi-submittal-mobile.md) | **Pending** (agent-ready) |
| **3.6** CO + Contracts mobile | `3.5.1` → `3.6.0` | [band-3.6-pm-co-contracts-mobile.md](./band-3.6-pm-co-contracts-mobile.md) | Pending stub |
| **3.7** Schedule Gantt + Kanban | `3.6.1` → `3.7.0` | [band-3.7-pm-schedule-gantt-kanban.md](./band-3.7-pm-schedule-gantt-kanban.md) | Pending stub |
| **3.8** CPM practices | `3.7.1` → `3.8.0` | [band-3.8-pm-cpm-practices.md](./band-3.8-pm-cpm-practices.md) | Pending stub |
| **3.9** Safety + Compliance | `3.8.1` → `3.9.0` | [band-3.9-pm-safety-compliance.md](./band-3.9-pm-safety-compliance.md) | Pending stub |
| **3.10** Vendors + Procurement + Materials | `3.9.1` → `3.10.0` | [band-3.10-pm-vendors-procurement-materials.md](./band-3.10-pm-vendors-procurement-materials.md) | Pending stub |
| **3.11** Pay apps + Quotes | `3.10.1` → `3.11.0` | [band-3.11-pm-sub-payapps-quotes.md](./band-3.11-pm-sub-payapps-quotes.md) | Pending stub |
| **3.12** PM hub polish | `3.11.1` → `3.12.0` | [band-3.12-pm-hub-polish.md](./band-3.12-pm-hub-polish.md) | Pending stub |
| Runway + **4.0.0** | `3.12.1` → `3.12.9` → `4.0.0` | [band-3.12-runway-and-4.0.0.md](./band-3.12-runway-and-4.0.0.md) | Pending stub |

**Next unshipped version row:** `3.4.6` (band 3.5 — phone-first Submittal list). RFI detail + confirm shipped at `3.4.5`.

## Shipped post-3.0 bands (prior)

| File | Role |
|------|------|
| `band-3.1-field-mobile.md` | Shipped 3.1.0–3.1.9 |
| `band-3.2-security-prod.md` | Shipped 3.2.0–3.2.9 |
| `band-3.3-today-on-site.md` | Shipped 3.3.0–3.3.9 |
| `band-3.4-checkpoint.md` | Shipped 3.4.0 |

## Historical drafts

| File | Role |
|------|------|
| `band-template.md` | Template |
| `band-2.23.md` | Historical draft — not on live ladder |
| `band-2.97-tail.md` | Historical tail — not on live ladder |

## Related

- Theme parking lot: [`docs/roadmap/post-3.0-product-bands.md`](../../roadmap/post-3.0-product-bands.md)  
- Agent-ready bar: [`docs/specs/README.md`](../README.md)  
