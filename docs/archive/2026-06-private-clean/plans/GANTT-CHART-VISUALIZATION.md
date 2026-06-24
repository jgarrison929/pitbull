# Gantt Chart Visualization — Design Specification (HISTORICAL)

> **Status:** Core visualization delivered (PM module polish, 0.14/0.15)
> **Module:** `Pitbull.ProjectManagement`
> **Author:** River (AI-assisted design)
> **Date:** 2026-02-20
> **Note:** Historical. Read-only Gantt on existing PmScheduleActivity etc data. Schedule entities, progress, Gantt rendering exist. See ProjectManagement services for schedule/gantt endpoints, frontend schedule views. Matches "Gantt chart" in delivered features. Phase 2 inline edit etc not shipped.

**Implemented as of June 2026 (verified):**
- Schedule entities in ProjectManagement/Domain/ProjectManagementEntities.cs (PmSchedule, PmScheduleActivity with WBS, dates, %, IsCritical, dependencies via PmScheduleDependency?).
- Frontend schedule page: src/app/(dashboard)/projects/[id]/schedule/page.tsx + dedicated GanttChart component (src/components/schedule/gantt-chart.tsx) with tree, timeline SVG?, dependencies (FS/FF/SS/SF), critical path, percent, virtual etc. (matches spec's custom SVG approach).
- PM module has CostCodeActivityMapping + progress linking to schedule (see changelog "Progress → Schedule → Cost").
- API endpoints exist for schedule (in ProjectManagementControllers or services).
- CHANGELOG mentions: "Gantt chart" in 0.14/0.15 PM polish, submittal PDF etc.
- No full "GanttController" + dedicated /gantt endpoint found in cursory search (uses general schedule data); read-only visual exists in project schedule view.
Core data model + frontend Gantt viz delivered per "PM module polish". Inline editing/Phase2 not present. Verify schedule UI and any gantt-specific code (search PmScheduleActivity + frontend components). (Doc's "Phase 1" mostly realized.)

---

## 1. Purpose & Scope

### 1.1 Problem Statement

The PM module has a full schedule data model — activities with planned/actual dates, durations, percent complete, WBS hierarchy, dependencies (FS/FF/SS/SF with lag), baselines, and critical path flags. But there is no visual schedule representation. Construction PMs universally expect a Gantt chart.

### 1.2 Scope

**Phase 1 (this spec):** Read-only interactive Gantt chart rendering existing `PmScheduleActivity` and `PmScheduleDependency` data. No inline editing.

**Phase 2 (future):** Inline editing, P6 XML import visualization, what-if scenarios.

### 1.3 Existing Entities (No Schema Changes Required — as of mid-2026)

- `PmScheduleActivity` (in ProjectManagementEntities.cs): Id, ProjectId, ActivityType (Wbs/Task/Milestone), Status (NotStarted/InProgress/Completed/OnHold), WBS, Name, Start/Finish dates, Duration, %Complete, Baselines, CriticalPath, etc.
- `PmScheduleDependency`: Predecessor/Successor Activity refs, DependencyType (FS/FF/SS/SF), LagDays.
- `PmSchedule` for overall schedule context.
- Linked to progress/cost via CostCode mapping in current foundation.
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
