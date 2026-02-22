# Gantt Chart Visualization — Design Specification

> **Status:** Draft
> **Module:** `Pitbull.ProjectManagement` (extends existing)
> **Author:** River (AI-assisted design)
> **Date:** 2026-02-20
> **Sponsor:** VP of Construction (Tom Reilly), VP of Sales (Demo Contact)
> **Executive Review Reference:** "The single most visually impactful missing feature. PMs expect a Gantt."

---

## 1. Purpose & Scope

### 1.1 Problem Statement

The PM module has a full schedule data model — activities with planned/actual dates, durations, percent complete, WBS hierarchy, dependencies (FS/FF/SS/SF with lag), baselines, and critical path flags. But there is no visual schedule representation. Construction PMs universally expect a Gantt chart.

### 1.2 Scope

**Phase 1 (this spec):** Read-only interactive Gantt chart rendering existing `PmScheduleActivity` and `PmScheduleDependency` data. No inline editing.

**Phase 2 (future):** Inline editing, P6 XML import visualization, what-if scenarios.

### 1.3 Existing Entities (No Schema Changes Required)

- `PmSchedule` — project schedule with status, data date, calendar type
- `PmScheduleActivity` — activities with WBS hierarchy, planned/actual dates, duration, percent complete, critical flag, float
- `PmScheduleDependency` — FS/FF/SS/SF with lag days
- `PmScheduleBaseline` — baseline snapshots for comparison

## 2. Library Selection

**Decision: Custom SVG + date-fns.** All commercial Gantt libraries (dhtmlx, Bryntum) have licensing risks. `gantt-task-react` is too limited. Our data model is already complete — we're rendering, not computing. ~800-1200 lines of focused React.

## 3. API: New Gantt Data Endpoint

`GET /api/projects/{projectId}/schedule/{scheduleId}/gantt` — returns all activities + dependencies in one request (no pagination).

## 4. Frontend Components

GanttPage → GanttToolbar (zoom) + GanttChart (split-pane: GanttTreeTable left, GanttTimeline SVG right) with bars, milestones, dependency arrows, data date line.

## 5. Features

- Zoom: day/week/month/quarter
- WBS tree collapse/expand
- Critical path highlighting (red bars, IsCritical flag)
- FS/FF/SS/SF dependency arrows
- Percent complete fill within bars
- Milestone diamonds
- Data date vertical line
- Hover tooltips with activity details
- Virtual scrolling for 500+ activities

## 6. Implementation: Phase 1 Only

1. Backend GanttController + DTO
2. Frontend GanttChart component tree
3. Dependency arrows (all 4 types)
4. Critical path highlighting
5. Zoom controls
6. Tests

*Full detailed spec with entity definitions, DTOs, color scheme, and test plan available — see commit history or ask River for expansion.*

---

*Addresses Executive Review concern C1 (VP of Construction, VP of Sales).*
