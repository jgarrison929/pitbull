# Spec: Help Center — office personas

**Status:** Pending  
**Version band:** 2.22.1 → 2.22.2 (parallel with KPI + CI close)  
**Related:** [`ROLE-EXPERIENCE.md`](../ROLE-EXPERIENCE.md), `help/page.tsx`

## Problem

Office personas need accurate workflow cards for CEO briefing, CFO WIP, PM approvals, estimator pipeline — matching role layouts.

## Personas

CEO, CFO, PM, Estimator (demo keys).

## User journey

Office user opens Help → persona-relevant card → deep link into live workflow.

## Primary code touchpoints

- `src/.../app/(dashboard)/help/page.tsx`  
- Role home components under `role-views/`  
- `docs/ROLE-EXPERIENCE.md`  

## API

UI-only.

## Version table

| Version | Deliverable | Acceptance |
|---------|-------------|------------|
| 2.22.1 | Cards: CEO briefing, CFO WIP, PM approvals, Estimator pipeline | Each card 3–5 steps + real href |
| 2.22.2 | FAQ: role profiles, demo explore, KPI drill truth | Mentions title-first role profiles; no fake KPI claims |

## Non-goals

- Duplicate field section (already Arc A)  

## Truth rules

- Match ROLE-EXPERIENCE metrics; label AR−AP net as proxy where applicable  

## Band DoD

- [ ] Office cards + FAQ live on help page  
