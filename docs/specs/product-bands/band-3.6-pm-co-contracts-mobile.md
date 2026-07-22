# Spec: Product band 3.6 — Change orders + Contracts mobile

**Status:** Pending (agent-ready)  
**Version band:** `3.5.1` → `3.6.0` (10 stamps)  
**Theme:** Mobile-friendly change orders and contract (subcontract) glance/detail  
**Epic:** [`docs/roadmap/pm-nextgen-3.4-to-4.0.md`](../../roadmap/pm-nextgen-3.4-to-4.0.md)  
**Domains:** Change Orders, Contract Management  
**CI notes (at checkpoint):** `docs/ci/pm-3.6-co-contracts-notes.md`

## Problem

COs and subcontracts are money/risk paths with desktop-first UIs; field PM cannot reliably review status on phone.

## Personas

| Persona | Need |
|---------|------|
| Project Manager | Open COs by job; status + amount glance; deep link detail |
| Contract Admin | Subcontract list/detail; SOV glance read-only |
| Superintendent | Status check only; large taps |

## Version table

| Version | Deliverable | Acceptance | Tests |
|---------|-------------|------------|-------|
| **3.5.1** | Open band: CO/subcontract mobile list field contract (id, number, title/subject, status, projectId, amount?, dueDate?); ban health/KPI | Documented fields + no KPI | docs |
| **3.5.2** | Slim CO list API `?view=mobile` | Paginated; no heavy collections; authz unchanged | unit/integration empty+one |
| **3.5.3** | Slim CO detail fields for phone | Subject, status, amount, reason readable | unit mapper |
| **3.5.4** | Phone-first CO list UI | ~390px; status + amount; honest empty | vitest empty copy |
| **3.5.5** | Phone-first CO detail + confirm status | Confirm-to-submit; no auto-post | unit guard |
| **3.5.6** | Slim subcontract list API mobile | Same slim rules | unit |
| **3.5.7** | Phone subcontract list + SOV glance read-only | No SOV edit on phone | vitest/manual |
| **3.5.8** | Help Center CO + contracts phone cards | Real routes | unit help |
| **3.5.9** | Buffer residual honesty + tests | No new domain | targeted tests |
| **3.6.0** | Checkpoint — mark Shipped; CI notes | Preflight green | CI notes |

## Mobile complaint drivers (research)

| Driver | Band response |
|--------|----------------|
| Commercial paper desktop-only | Owner + sub contract list/detail + CO status on phone |
| Pay/CO delays from missing status visibility | Confirm-to-submit; real workflow enums only |
| Pocket-first | ~390px; no portfolio contract health score |

## Non-goals

- Full SOV edit on phone; relocating Contracts module; invented approval KPIs; portfolio contract health scores

## Module SoT

- `Pitbull.Contracts` / ChangeOrders / Subcontracts controllers  
- Web: `/change-orders`, `/contracts`, `/projects/[id]/change-orders`

## Truth rules

- Status labels match server enums  
- Empty list ≠ “all COs clear”  
- Amounts only when server returns them  

## Deploy DoD

Every stamp: full version stamp set + preflight `-FullWeb -DotNet`
