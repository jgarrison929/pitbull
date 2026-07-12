# Spec: Role KPI drill-through contracts

**Status:** Pending  
**Version band:** 2.22.1 → 2.22.2 (2 PRs)  
**Related:** [`ROLE-EXPERIENCE.md`](../ROLE-EXPERIENCE.md), `roleKpiDrillHref` / `role-kpi-drills`

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
| Drill helpers | `src/.../lib/role-kpi-drills.ts` (or equivalent), `role-kpi-drills.test.ts` |
| Role views | `src/.../components/dashboard/role-views/*` |
| Executive briefing | search briefing components |
| ROLE-EXPERIENCE | `docs/ROLE-EXPERIENCE.md` |

## API

UI routing contracts; list pages must honor query filters that KPIs claim.

## Version table

### 2.22.1 — Audit matrix

**Deliverable:** Table of KPI → href → API/list filter for all demo personas.

**Acceptance:**
- [ ] Matrix committed in this file §Audit matrix (fill during PR)  
- [ ] Orphans listed with severity  

### 2.22.2 — Fix orphans + vitest

**Deliverable:** Fix orphan KPIs; vitest href matrix green.

**Acceptance:**
- [ ] No home KPI without drill (or explicit non-clickable with reason)  
- [ ] Vitest covers matrix  
- [ ] Spec Status shipped through 2.22.2 (with help office if same PR split)  

## Audit matrix (fill in 2.22.1)

| Persona | KPI / tile | Href | Filter contract | Status |
|---------|------------|------|-----------------|--------|
| CEO | … | … | … | pending |
| CFO | … | … | … | pending |
| PM | … | … | … | pending |
| Estimator | … | … | … | pending |
| Super | … | … | … | pending |

## Non-goals

- New KPIs inventing metrics  

## Truth rules

- Label AR−AP net and other proxies per ROLE-EXPERIENCE  
- Never invent executive consolidation numbers  

## Band DoD

- [ ] Matrix complete + tests green  
