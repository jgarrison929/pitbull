# Spec: Product band 3.11 — Sub pay apps + Estimates/Quotes (stub)

**Status:** Pending (stub — expand before first `/goal`)  
**Version band:** `3.10.1` → `3.11.0` (10 stamps)  
**Theme:** Mobile subcontractor pay application status + estimates/quotes (bids) glance  
**Epic:** [`docs/roadmap/pm-nextgen-3.4-to-4.0.md`](../../roadmap/pm-nextgen-3.4-to-4.0.md)  
**Domains:** Subcontractor Management — Pay Apps, Estimates/Quotes (Procurement covered in 3.10)  

## Problem

Pay apps (G702/G703) and bids are desktop-heavy; PMs need phone status glance and deep links, not full billing edit on a phone.

## Sketch

| Version | Intent |
|---------|--------|
| 3.10.1 | Expand stub: pay app mobile status DTO (real statuses only) |
| 3.10.2–3.10.5 | Payment application list/detail mobile (read-heavy) |
| 3.10.6–3.10.7 | Bids/quotes list mobile for PM/estimator filtered drill |
| 3.10.8 | Help |
| 3.10.9 | Buffer |
| 3.11.0 | Checkpoint |

## Module SoT

- `PaymentApplicationsController` / Contracts payment flows  
- `Pitbull.Bids` for estimates/quotes  

## Non-goals

- Full AIA line edit on phone; inventing “sub performance score”; moving pay apps into ProjectManagement DB  

## Mobile complaint drivers (research)

| Driver | Band response |
|--------|----------------|
| G702/pay status invisible away from desk | Read-heavy list/detail + status honesty |
| Backup/compliance lag (waivers/insurance) | Deep links to compliance/pay — no fake ready-to-pay score |
| Bids/quotes not PM-glanceable | Estimator + PM filtered list (real pipeline $ only if API has it) |

Research: §1.4, §2 rank 8 in [`pm-mobile-workflows-and-complaints-2026.md`](../../roadmap/pm-mobile-workflows-and-complaints-2026.md).

## Expand checklist

- [ ] Agent-ready version rows + acceptance + tests + help + truth  

