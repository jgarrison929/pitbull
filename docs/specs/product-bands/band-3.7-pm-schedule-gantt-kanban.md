# Spec: Product band 3.7 — Schedule Gantt phone + Kanban

**Status:** Pending (agent-ready)  
**Version band:** `3.6.1` → `3.7.0` (10 stamps)  
**Theme:** Phone-usable schedule Gantt glance + Kanban for activity/task flow  
**Epic:** [`docs/roadmap/pm-nextgen-3.4-to-4.0.md`](../../roadmap/pm-nextgen-3.4-to-4.0.md)  
**CI notes (at checkpoint):** `docs/ci/pm-3.7-schedule-notes.md`

## Problem

`/projects/[id]/schedule` is Gantt-oriented desktop; no true Kanban; phone cannot glance critical work without horizontal pan hell.

## Version table

| Version | Deliverable | Acceptance | Tests |
|---------|-------------|------------|-------|
| **3.6.1** | Open: schedule mobile contract (activity id, name, status, start, finish, isCritical?, float?) | No SPI/CPI invent | docs |
| **3.6.2** | Slim activity list API mobile | Paginated; critical filter server-side if present | unit |
| **3.6.3** | Phone schedule list hybrid (today + critical filters) | ~390px; honest empty | vitest |
| **3.6.4** | Gantt phone glance mode (zoom/pan honesty, no full drag edit) | Usable glance; no P6 claim | manual/unit |
| **3.6.5** | Activity detail phone | Dates + status + critical flag | unit |
| **3.6.6** | Kanban columns from real activity/task status | Real enums only; no fake WIP invent | unit |
| **3.6.7** | Kanban phone UI | Drag optional; status confirm if mutates | unit |
| **3.6.8** | Help schedule/Kanban phone | Real routes | help tests |
| **3.6.9** | Buffer residual | No new domain | tests |
| **3.7.0** | Checkpoint + CI notes | Shipped | preflight |

## Mobile complaint drivers (research)

| Driver | Band response |
|--------|----------------|
| Schedule invisible on phone | Critical + today filters; list/hybrid glance |
| Desktop Gantt unusable at 390px | No full drag edit; honest zoom/pan |
| Field→office lag on progress | Filtered drill — no invented % complete |

## Non-goals

- Full P6 edit on phone; multi-project Gantt portfolio; invented SPI/CPI without EV data

## Touchpoints

- `api/projects/{id}/schedules/**`, schedule page components
