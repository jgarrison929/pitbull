# Spec: Role KPI drill-through contracts

**Status:** In progress (audit matrix 2.22.1; orphan fixes + vitest matrix 2.22.2)  
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
| Role views | `src/.../components/dashboard/role-views/*` |
| Executive briefing | `morning-briefing.tsx`, `kpi-cards-widget.tsx` |
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
- [ ] No home KPI without drill (or explicit non-clickable with reason)  
- [ ] Vitest covers matrix  
- [ ] Spec Status shipped through 2.22.2 (with help office if same PR split)  

## Audit matrix (2.22.1)

Source of truth for hrefs: `ROLE_KPI_DRILL_CONTRACTS` in `role-kpi-drill-contracts.ts`. Consumers below audited against role views + morning briefing + kpi-cards-widget (2026-07-12).

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
| Pending approvals card | `/` + `/time-tracking/approval/mobile` | Live GET /api/approvals/pending | OK (not RoleKpiKey) |

### Estimator

| KPI / tile | Href | Filter contract | Status |
|------------|------|-----------------|--------|
| Bid pipeline | `/bids?pipeline=open` | Draft OR Submitted | OK |
| Estimator projects | `/projects?excludeCompleted=true` | Not completed | OK |

### Superintendent (field layout)

| KPI / tile | Href | Filter contract | Status |
|------------|------|-----------------|--------|
| Field report (last job) | `/projects/{id}/...` field report | Job-scoped capture | OK (action, not RoleKpiKey) |
| Site walk | site-walk href | Job-scoped | OK (action) |
| Twin | `/projects/{id}/twin` | Job twin | OK (action) |
| Project list links | `/projects/{id}` | Detail | OK |

### Shared widgets / morning briefing

| KPI / tile | Href | Filter contract | Status |
|------------|------|-----------------|--------|
| kpi-cards: active, workforce, hours, pending time, open RFIs | contract table | per key | OK |
| briefing: open COs | `/change-orders?status=open` | Pending/UnderReview | OK |
| briefing: bid pipeline | `/bids?pipeline=open` | Open pipeline | OK |
| briefing: AP near-term | `/billing/aging?focus=ap` | AP focus (near-term is label; list is full AP board) | **Partial** — severity Low (proxy label) |

## Orphans (severity)

| Item | Severity | Notes | Target fix |
|------|----------|-------|------------|
| `apNearTerm` drill uses same href as `apTotal` (no due-date filter on aging page) | Low | Headline is Current+1–30; list is AP focus without near-term-only filter | 2.22.2 — document or add query if consumer supports it |
| Field home has no RoleKpiKey portfolio KPIs | N/A | By design: capture + glance, not portfolio aggregation | No fix — intentional |
| Contract keys not shown on a given persona home | N/A | e.g. `compliance` full list vs attention only | Not orphans if unused |

## Non-goals

- New KPIs inventing metrics  

## Truth rules

- Label AR−AP net and other proxies per ROLE-EXPERIENCE  
- Never invent executive consolidation numbers  

## Band DoD

- [x] Matrix complete (2.22.1)  
- [ ] Tests green covering matrix (2.22.2)  
