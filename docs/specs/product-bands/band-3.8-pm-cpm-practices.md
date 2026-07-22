# Spec: Product band 3.8 — CPM practices honesty (stub)

**Status:** Pending (stub — expand before first `/goal`)  
**Version band:** `3.7.1` → `3.8.0` (10 stamps)  
**Theme:** Critical path, float, data-date, baseline variance — labeled and mobile-glanceable  
**Epic:** [`docs/roadmap/pm-nextgen-3.4-to-4.0.md`](../../roadmap/pm-nextgen-3.4-to-4.0.md)  
**Domains:** CPM Practices  

## Problem

Server has float, `IsCritical`, critical-path recalculate, baselines; UX does not teach or show CPM honestly on phone.

## Sketch

| Version | Intent |
|---------|--------|
| 3.7.1 | Expand stub: CPM field glossary + data-date display rules |
| 3.7.2–3.7.5 | Surface total/free float, critical flag on mobile schedule/activity detail |
| 3.7.6–3.7.7 | Recalculate action honesty + last-run timestamp |
| 3.7.8 | Help CPM for supers/PMs |
| 3.7.9 | Buffer |
| 3.8.0 | Checkpoint |

## Touchpoints

- `POST .../critical-path/recalculate`, variance, baseline endpoints  
- Schedule activity DTO fields already on `PmScheduleActivity`  

## Non-goals

- Claiming enterprise P6 parity; inventing float when null; auto-recalc without user action if current product requires explicit run  

## Mobile complaint drivers (research)

| Driver | Band response |
|--------|----------------|
| CPM opaque on phone | Surface float, critical flag, data-date, last recalculate honestly |
| Fake “on track” health | Insufficient data stays insufficient — no default green |

Research: §1.3, §2 rank 7 in [`pm-mobile-workflows-and-complaints-2026.md`](../../roadmap/pm-mobile-workflows-and-complaints-2026.md).

## Expand checklist

- [ ] Agent-ready version rows + acceptance + tests + help + truth  

