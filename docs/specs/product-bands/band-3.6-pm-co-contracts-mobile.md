# Spec: Product band 3.6 — Change orders + Contracts mobile (stub)

**Status:** Pending (stub — expand to agent-ready before first `/goal`)  
**Version band:** `3.5.1` → `3.6.0` (10 stamps)  
**Theme:** Mobile-friendly change orders and contract (subcontract) glance/detail  
**Epic:** [`docs/roadmap/pm-nextgen-3.4-to-4.0.md`](../../roadmap/pm-nextgen-3.4-to-4.0.md)  
**Domains:** Change Orders, Contract Management  

## Problem

COs and subcontracts are money/risk paths with desktop-first UIs; field PM cannot reliably review status on phone.

## Sketch version themes (expand before 3.5.1)

| Version | Intent |
|---------|--------|
| 3.5.1 | Agent-ready expansion of this stub + CO mobile list contract |
| 3.5.2–3.5.4 | Slim CO list/detail API + phone UI |
| 3.5.5–3.5.7 | Subcontract list/detail mobile + SOV glance (read-only on phone) |
| 3.5.8 | Help |
| 3.5.9 | Buffer residual |
| 3.6.0 | Checkpoint + `docs/ci/pm-3.6-co-contracts-notes.md` |

## Module SoT

- `Pitbull.Contracts` / `ChangeOrdersController` / `SubcontractsController`  
- Web: `/change-orders`, `/contracts`, `/projects/[id]/change-orders`  

## Non-goals

- Full SOV edit on phone; relocating Contracts module; invented approval KPIs  

## Mobile complaint drivers (research)

| Driver | Band response |
|--------|----------------|
| Commercial paper desktop-only (CO/contract negotiate) | Owner + sub contract list/detail + CO status on phone |
| Pay/CO delays from missing status visibility | Confirm-to-submit status; real workflow enums only |
| Pocket-first | ~390px; no portfolio contract “health” score |

Research: [`pm-mobile-workflows-and-complaints-2026.md`](../../roadmap/pm-mobile-workflows-and-complaints-2026.md) §1.4, §2 ranks 1 & 8.

## Expand checklist (before first ship)

- [ ] Full version table with acceptance `- [ ]` per row  
- [ ] API/UI touchpoints + test plan + truth rules + deploy DoD  

