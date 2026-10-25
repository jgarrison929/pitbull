# Spec: Role KPI drill-through contracts

**Status:** Shipped through **2.22.2**  
**Version band:** 2.22.1 → 2.22.2 (2 PRs)  
**Related:** [`ROLE-EXPERIENCE.md`](../ROLE-EXPERIENCE.md), `role-kpi-drill-contracts.ts`, `role-kpi-drills.ts`

## Problem

Home KPI cards and briefing tiles must always drill to filtered lists; orphan KPIs cause rage clicks (historical 2.8.x pattern).

## Personas

CEO, CFO, PM, Estimator, Superintendent (field home actions).

## User journey

1. User taps KPI/card on home  
2. Lands on list/page with filters applied matching the card’s claim  
3. Empty state honest when zero rows  

## Primary code touchpoints

| Area | Paths |
|------|-------|
| Drill contracts | `src/.../lib/role-kpi-drill-contracts.ts` |
| Drill helpers | `src/.../lib/role-kpi-drills.ts`, `role-kpi-drills.test.ts`, `role-kpi-drill-parity.test.ts` |
| Persona matrix | `role-kpi-persona-matrix.test.ts` |
| Role views | `src/.../components/dashboard/role-views/*` |
| Aging consumer | `billing/aging/page.tsx` (`overdue`, `nearTerm`) |
| ROLE-EXPERIENCE | `docs/ROLE-EXPERIENCE.md` |

## API

UI routing contracts; list pages must honor query filters that KPIs claim.

## Version table

### 2.22.1 — Audit matrix

**Deliverable:** Table of KPI → href → API/list filter for all demo personas.

**Acceptance:**
- [x] Matrix committed in this file §Audit matrix  
- [x] Orphans listed with severity  

### 2.22.2 — Fix orphans + vitest

**Deliverable:** Fix orphan KPIs; vitest href matrix green.

**Acceptance:**
- [x] No home KPI without drill (or explicit non-clickable with reason)  
- [x] Vitest covers matrix (`role-kpi-persona-matrix.test.ts` + parity)  
- [x] Spec Status shipped through 2.22.2  

## Audit matrix (2.22.1)

Source of truth for hrefs: `ROLE_KPI_DRILL_CONTRACTS` in `role-kpi-drill-contracts.ts`.

### CEO (executive layout)

| KPI / tile | Href | Filter contract | Status |
|------------|------|-----------------|--------|
| Active projects | `/projects?excludeCompleted=true` | Status != Completed | OK |
| Billed to date | `/billing/applications?scope=progress` | Progress applications | OK |
| Unbilled backlog | `/projects?unbilled=true&excludeCompleted=true` | Unbilled > 0, not completed | OK |
| AR−AP net (proxy) | `/billing/aging` | focus=both | OK |
| AR overdue | `/billing/aging?focus=ar&overdue=true` | AR 31+ days | OK |
| Budget alert (≥75%) | `/projects?budgetAlert=true&budgetAlertPercent=75` | Labor % ≥ 75 | OK |
| Safety YTD | `/reports/safety?period=ytd` | Incidents YTD | OK |
| Compliance attention | `/reports/compliance?status=attention` | Expiring/Expired | OK |
| Open RFIs | `/rfis?status=notClosed` | Status != Closed | OK |
| Workforce | `/employees?isActive=true` | IsActive | OK |

### CFO (controller layout)

| KPI / tile | Href | Filter contract | Status |
|------------|------|-----------------|--------|
| AR total | `/billing/aging?focus=ar` | AR focus | OK |
| AP total | `/billing/aging?focus=ap` | AP focus | OK |
| AR−AP net | `/billing/aging` | focus=both | OK |
| Budget alert strict (≥90%) | `/projects?budgetAlert=true&budgetAlertPercent=90` | Labor % ≥ 90 | OK |
| Billed to date | `/billing/applications?scope=progress` | Progress scope | OK |
| Unbilled backlog | `/projects?unbilled=true&excludeCompleted=true` | Unbilled list | OK |

### PM (pm layout)

| KPI / tile | Href | Filter contract | Status |
|------------|------|-----------------|--------|
| Active projects | `/projects?excludeCompleted=true` | Not completed | OK |
| Open RFIs | `/rfis?status=notClosed` | Not closed | OK |
| Hours this week | `/time-tracking?view=entries&period=thisWeek` | Current week entries | OK |
| View RFIs (action) | `/rfis?status=notClosed` | Same as openRfis | OK |
| Pending time (briefing/widget) | `/time-tracking/approval?status=pending` | Submitted time | OK |

### Estimator

| KPI / tile | Href | Filter contract | Status |
|------------|------|-----------------|--------|
| Bid pipeline | `/bids?pipeline=open` | Draft OR Submitted | OK |
| Estimator projects | `/projects?excludeCompleted=true` | Not completed | OK |

### Superintendent (field layout)

| KPI / tile | Href | Filter contract | Status |
|------------|------|-----------------|--------|
| Field actions (report, site walk, twin) | job-scoped routes | Capture + glance | OK intentional — no portfolio RoleKpiKey |

### Shared / briefing

| KPI / tile | Href | Filter contract | Status |
|------------|------|-----------------|--------|
| AP near-term | `/billing/aging?focus=ap&nearTerm=true` | Current + 1–30 line filter | **OK (fixed 2.22.2)** |

## Orphans (closed)

| Item | Resolution |
|------|------------|
| `apNearTerm` shared AP board only | Fixed: `nearTerm=true` + `agingLineHasNearTerm` |
| Field home no portfolio KPIs | By design |

## Non-goals

- New KPIs inventing metrics  

## Truth rules

- Label AR−AP net and other proxies per ROLE-EXPERIENCE  
- Never invent executive consolidation numbers  

## Band DoD

- [x] Matrix complete  
- [x] Tests green covering matrix  
