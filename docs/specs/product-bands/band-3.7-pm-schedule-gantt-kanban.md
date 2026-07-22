# Spec: Product band 3.7 — Schedule Gantt phone + Kanban (stub)

**Status:** Pending (stub — expand before first `/goal`)  
**Version band:** `3.6.1` → `3.7.0` (10 stamps)  
**Theme:** Phone-usable schedule Gantt glance + Kanban board for activity/task flow  
**Epic:** [`docs/roadmap/pm-nextgen-3.4-to-4.0.md`](../../roadmap/pm-nextgen-3.4-to-4.0.md)  
**Domains:** Schedule (Gantt & Kanban)  

## Problem

`/projects/[id]/schedule` is Gantt-oriented desktop; no true Kanban; phone cannot glance critical work without horizontal pan hell.

## Sketch

| Version | Intent |
|---------|--------|
| 3.6.1 | Expand stub: Gantt mobile view modes (critical filter, today line) |
| 3.6.2–3.6.5 | Phone Gantt/list hybrid; activity slim DTO |
| 3.6.6–3.6.8 | Kanban columns from real activity/task status (no fake WIP limits invent) |
| 3.6.9 | Buffer |
| 3.7.0 | Checkpoint + CI notes |

## Touchpoints

- `api/projects/{id}/schedules/**`, schedule page components  
- Tasks page may feed Kanban — do not invent second schedule DB  

## Non-goals

- Full P6 edit on phone; multi-project Gantt portfolio; invented SPI/CPI tiles without earned-value data  

## Mobile complaint drivers (research)

| Driver | Band response |
|--------|----------------|
| Schedule invisible / Excel on phone | Critical-path + today filter glance; Kanban for activity/task status |
| Desktop Gantt unusable at 390px | List/hybrid + zoom/pan honesty — **not** full drag edit |
| Field→office lag on progress | Filtered drill to progress/RFI — no invented % complete |

Research: §1.3, §2 ranks 1 & 7 in [`pm-mobile-workflows-and-complaints-2026.md`](../../roadmap/pm-mobile-workflows-and-complaints-2026.md).

## Expand checklist

- [ ] Agent-ready version rows + acceptance + tests + help + truth  

