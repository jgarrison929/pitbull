# Spec: Product band 3.10 — Vendors + Procurement + Material tracking (stub)

**Status:** Pending (stub — expand before first `/goal`)  
**Version band:** `3.9.1` → `3.10.0` (10 stamps)  
**Theme:** Mobile vendor/PO glance + first-class material tracking honesty  
**Epic:** [`docs/roadmap/pm-nextgen-3.4-to-4.0.md`](../../roadmap/pm-nextgen-3.4-to-4.0.md)  
**Domains:** Vendors, Procurement (part of Subcontractor Management), Material tracking  

## Problem

Vendors and POs live under Billing/Ops desktop; materials are fragmented (deliveries OCR, stored materials on pay apps) without a coherent field register.

## Sketch

| Version | Intent |
|---------|--------|
| 3.9.1 | Expand stub: material tracking data contract (real deliveries/POs only) |
| 3.9.2–3.9.4 | Vendor list/detail mobile filters |
| 3.9.5–3.9.7 | PO list/detail mobile for project; material log from deliveries |
| 3.9.8 | Help |
| 3.9.9 | Buffer |
| 3.10.0 | Checkpoint |

## Module SoT

- **Vendors / POs / invoices:** `Pitbull.Billing` — do not fork  
- **Deliveries:** daily report deliveries API  
- Pay-app stored materials stay Billing; link only  

## Non-goals

- Full inventory WMS; dual-write vendor master into PM module  

## Mobile complaint drivers (research)

| Driver | Band response |
|--------|----------------|
| Field materials/docs not phone-usable | Delivery capture + project-scoped PO glance |
| Offline / “update later = never” | Honest queue only when implemented |
| Desktop procurement for field glance | Vendor/PO list filtered drill — not full AP desk |

Research: §1.6, §2 ranks 1–2 & 6 in [`pm-mobile-workflows-and-complaints-2026.md`](../../roadmap/pm-mobile-workflows-and-complaints-2026.md).

## Expand checklist

- [ ] Agent-ready version rows + acceptance + tests + help + truth  

