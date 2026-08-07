# Spec: Product band 3.8 — CPM practices honesty

**Status:** Partial — shipped **`3.7.1`–`3.7.5`**; free remaining **`3.7.8`–`3.8.0`** (see stamp remap)  
**Version band:** `3.7.1` → `3.8.0` (10 stamps; two diverted)  
**Theme:** Critical path, float, data-date, baseline variance — labeled and mobile-glanceable  
**Epic:** [`docs/roadmap/pm-nextgen-3.4-to-4.0.md`](../../roadmap/pm-nextgen-3.4-to-4.0.md)  
**CI notes (at checkpoint):** `docs/ci/pm-3.8-cpm-notes.md`  
**Product VERSION (docs stance):** `3.7.7` → next free **`3.7.8`**

## Problem

Server has float, `IsCritical`, critical-path recalculate, baselines; UX does not teach or show CPM honestly on phone.

## Version table

| Version | Deliverable | Acceptance | Tests | Row state |
|---------|-------------|------------|-------|-----------|
| **3.7.1** | Open: CPM glossary + data-date display rules (docs + UI copy helpers) | No fake on-track default | unit copy | **Shipped** |
| **3.7.2** | Surface isCritical on mobile activity list/detail | Real flag only | unit | **Shipped** |
| **3.7.3** | Surface total/free float when server has values; null stays insufficient | Label proxies honestly | unit | **Shipped** |
| **3.7.4** | Data-date display on schedule phone glance | ISO/server value | unit | **Shipped** |
| **3.7.5** | Baseline variance glance when baseline exists | No invent when missing | unit | **Shipped** |
| **3.7.6** | ~~Recalculate critical path action honesty~~ | — | — | **Diverted** — dependency audit (CHANGELOG); **do not reclaim** |
| **3.7.7** | ~~Phone UI for recalc + last run~~ | — | — | **Diverted** — WIP BilledToDate fix (CHANGELOG); **do not reclaim** |
| **3.7.8** | Recalculate critical path action honesty + last-run timestamp **and** phone UI for recalc + last run (consolidated from diverted 3.7.6/3.7.7 intents) | Confirm-to-run; no silent auto; confirm dialog | unit | **Next free** |
| **3.7.9** | Help CPM for supers/PMs + buffer residual (consolidated) | Real routes; no new domain | help + unit | Remaining |
| **3.8.0** | Checkpoint + CI notes | Shipped | preflight | Remaining |

### Stamp remap note

Product published **`3.7.6`** (dep-audit) and **`3.7.7`** (WIP BilledToDate) outside band 3.8 CPM scope. Remaining CPM intents that originally sat on those numbers move only onto free stamps **`3.7.8`–`3.8.0`** (consolidated). Never reuse spent stamps.

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

Shipped CPM through **`3.7.5`**. Finish band on **`3.7.8` → `3.8.0`** only (remapped table above).
