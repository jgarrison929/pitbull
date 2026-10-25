# Spec: Product band 3.9 — Safety + Compliance mobile (stub)

**Status:** Pending (stub — expand before first `/goal`)  
**Version band:** `3.8.1` → `3.9.0` (10 stamps)  
**Theme:** Safety incident capture/list + compliance document glance on phone  
**Epic:** [`docs/roadmap/pm-nextgen-3.4-to-4.0.md`](../../roadmap/pm-nextgen-3.4-to-4.0.md)  
**Domains:** Safety, Compliance  

## Problem

Safety is mostly report/YTD KPI; compliance is admin register. Field capture and project glance are weak.

## Sketch

| Version | Intent |
|---------|--------|
| 3.8.1 | Expand stub: safety incident mobile capture contract |
| 3.8.2–3.8.5 | Capture + list for project safety (real entities; severity honesty) |
| 3.8.6–3.8.7 | Compliance docs list by project/vendor with expiry honesty |
| 3.8.8 | Help |
| 3.8.9 | Buffer |
| 3.9.0 | Checkpoint |

## Touchpoints

- Safety enums in ProjectManagement; dashboard safety YTD; daily report safety narrative  
- `ComplianceDocumentsController`; `/admin/compliance`, `/reports/compliance`  

## Non-goals

- Invented OSHA scores; portfolio safety % complete; replacing certified payroll  

## Mobile complaint drivers (research)

| Driver | Band response |
|--------|----------------|
| Insurance/compliance desktop-only for CA/PM | Expiry glance for sub + company docs; expired honesty |
| Safety capture stuck in report-only | Incident/near-miss capture + list on phone |
| Pocket-first | Large taps; no composite “safety health” KPI |

Research: §1.5, §2 ranks 1 & 8 in [`pm-mobile-workflows-and-complaints-2026.md`](../../roadmap/pm-mobile-workflows-and-complaints-2026.md).

## Expand checklist

- [ ] Agent-ready version rows + acceptance + tests + help + truth  

