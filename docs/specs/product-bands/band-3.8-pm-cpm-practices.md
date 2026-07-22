# Spec: Product band 3.8 — CPM practices honesty

**Status:** Pending (agent-ready)  
**Version band:** `3.7.1` → `3.8.0` (10 stamps)  
**Theme:** Critical path, float, data-date, baseline variance — labeled and mobile-glanceable  
**Epic:** [`docs/roadmap/pm-nextgen-3.4-to-4.0.md`](../../roadmap/pm-nextgen-3.4-to-4.0.md)  
**CI notes (at checkpoint):** `docs/ci/pm-3.8-cpm-notes.md`

## Problem

Server has float, `IsCritical`, critical-path recalculate, baselines; UX does not teach or show CPM honestly on phone.

## Version table

| Version | Deliverable | Acceptance | Tests |
|---------|-------------|------------|-------|
| **3.7.1** | Open: CPM glossary + data-date display rules (docs + UI copy helpers) | No fake on-track default | unit copy |
| **3.7.2** | Surface isCritical on mobile activity list/detail | Real flag only | unit |
| **3.7.3** | Surface total/free float when server has values; null stays insufficient | Label proxies honestly | unit |
| **3.7.4** | Data-date display on schedule phone glance | ISO/server value | unit |
| **3.7.5** | Baseline variance glance when baseline exists | No invent when missing | unit |
| **3.7.6** | Recalculate critical path action honesty + last-run timestamp | Confirm-to-run; no silent auto | unit |
| **3.7.7** | Phone UI for recalc + last run | Confirm dialog | unit |
| **3.7.8** | Help CPM for supers/PMs | Real routes | help tests |
| **3.7.9** | Buffer residual | No new domain | tests |
| **3.8.0** | Checkpoint + CI notes | Shipped | preflight |

## Mobile complaint drivers (research)

| Driver | Band response |
|--------|----------------|
| CPM opaque on phone | Surface float, critical flag, data-date honestly |
| Fake “on track” health | Insufficient data stays insufficient — no default green |

## Non-goals

- Claiming enterprise P6 parity; inventing float when null; auto-recalc without user action if product requires explicit run

## Touchpoints

- `POST .../critical-path/recalculate`, variance, baseline endpoints  
- `PmScheduleActivity` float/critical fields  

## Goal for this program arc stop

Stamps through **`3.7.5`** are in-scope for the 3.4.6→3.7.5 loop; **`3.7.6`–`3.8.0`** ship later.
