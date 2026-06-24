# Construction Schedule Module — Design Specification ("P6 Killer")

> **Status:** Draft
> **Module:** `Pitbull.ProjectManagement` (extends existing)
> **Author:** River (AI-assisted design)
> **Date:** 2026-02-22
> **Sponsor:** VP of Construction (Tom Reilly), VP of Sales (Demo Contact)
> **Executive Review Reference:** "The single most visually impactful missing feature. PMs expect a Gantt." (C1)
> **References:** `docs/plans/GANTT-CHART-VISUALIZATION.md`, `docs/roles/PROJECT-MANAGER.md`, `.claude/skills/erp-project-management/SKILL.md`

---

## 0) Why This Module Exists

### The Problem with Primavera P6

Oracle Primavera P6 is the industry standard for construction scheduling. It is also universally despised by the people who use it daily.

**Why PMs hate P6:**
- **Licensing:** $3,000-$5,000/user/year. For a 15-PM firm, that's $45K-$75K just for scheduling.
- **Deployment:** P6 EPPM requires Oracle DB, WebLogic, and a dedicated IT team. P6 Professional requires a local install that breaks with every Windows update.
- **UX:** The interface was designed in 2004 and has barely changed. Three clicks to update percent complete. Modal dialogs nested inside modal dialogs.
- **Integration:** Getting data out of P6 requires XER/XML export → manual import into everything else. The API exists but is SOAP-based and barely documented.
- **Mobile:** There is no real mobile experience. Superintendents can't update from the field without a laptop.
- **Collaboration:** P6 is single-user. No real-time collaboration. File locking. Version conflicts. "Who has the latest schedule?" is a daily question.

**Why PMs still use P6:**
- CPM calculation engine is proven and trusted by courts
- Owner/architect contracts often require "CPM schedule in P6 format"
- Delay claims require forensic schedule analysis that P6 handles
- Earned value management is built in
- Every scheduler in the industry knows P6

**Our opportunity:** Build a scheduling engine that does everything P6 does computationally, but lives inside the ERP where schedule data connects to cost, labor, submittals, RFIs, and billing. No more exporting XER files and hoping someone imports them correctly.

### What Construction Scheduling Actually Is

Construction scheduling is not project management scheduling (Jira, Asana). The differences are fundamental:

1. **CPM (Critical Path Method)** is not optional. It is a contractual requirement on virtually all commercial projects. The critical path determines the project completion date, and any activity on it that slips extends the project. Courts use CPM analysis to resolve delay disputes worth millions.

2. **Dependencies are physical, not arbitrary.** You cannot pour concrete before the forms are set. You cannot hang drywall before framing is inspected. These are not "nice to have" dependency links -- they are physical reality.

3. **Weather matters.** A concrete pour scheduled for Tuesday gets pushed to Thursday because of rain. The entire downstream chain shifts. This happens weekly on most projects.

4. **Schedules are legal documents.** The baseline schedule is a contract exhibit. Monthly schedule updates are submitted to the owner. Delay claims reference specific schedule activities and float consumption. An incorrect CPM calculation can cost a contractor millions in liquidated damages.

5. **Resource leveling is about crews, not developers.** You have 4 concrete crews and 12 pours scheduled next week. Which crews go where? This is not an abstract optimization -- it's logistics that determines whether people show up to the right job site.

---

## 1) Existing Entity Model (No Schema Changes for Phase 1)

The data model is already comprehensive. These entities exist in `Pitbull.ProjectManagement.Domain`:

### 1.1 Schedule Core

| Entity | Purpose | Key Fields |
|--------|---------|------------|
| `PmSchedule` | Project schedule container | ProjectId, Status (Draft/Active/Baselined/Archived), DataDate, CalendarType, ImportedFrom, LastCriticalPathRunAt |
| `PmScheduleActivity` | Individual schedule activity | ScheduleId, ParentActivityId (WBS hierarchy), WbsCode, ActivityCode, ActivityType (Wbs/Task/Milestone), Status, OriginalDurationDays, RemainingDurationDays, PlannedStart/Finish, EarlyStart/Finish, LateStart/Finish, ActualStart/Finish, TotalFloatDays, FreeFloatDays, PercentComplete, IsCritical, CostCodeId, PhaseId, SortOrder |
| `PmScheduleDependency` | Activity-to-activity link | PredecessorActivityId, SuccessorActivityId, DependencyType (FS/FF/SS/SF), LagDays |
| `PmScheduleBaseline` | Snapshot of schedule at a point in time | ScheduleId, Name, BaselineType (Initial/ApprovedRevision/Recovery), CapturedAt, CapturedByUserId |
| `PmScheduleBaselineActivity` | Per-activity baseline dates | BaselineId, ActivityId, BaselineStart, BaselineFinish, BaselineDurationDays |
| `PmScheduleResourceAssignment` | Resource linked to activity | ActivityId, ResourceType (Crew/Equipment/Subcontract), EmployeeId, EquipmentId, SubcontractId, PlannedUnits, ActualUnits, PlannedHours, ActualHours |
| `PmScheduleCalendarException` | Non-working days | ScheduleId, Date, ExceptionType (Holiday/WeatherShutdown/CompanyShutdown/Custom), WorkHours |
| `PmScheduleImportLog` | Import audit trail | ProjectId, ImportSource (Csv/P6Xml/MsProject), Status, FileName, RowsProcessed, RowsFailed, ErrorSummary |

### 1.2 Earned Value & Progress

| Entity | Purpose | Key Fields |
|--------|---------|------------|
| `PmEarnedValueSnapshot` | Periodic EV metrics | ProjectId, SnapshotDate, BCWS, BCWP, ACWP, CPI, SPI, EstimateAtCompletion, VarianceAtCompletion |
| `PmSCurvePoint` | S-curve data for plotting | ProjectId, CurveDate, PlannedPercent, ActualPercent, EarnedPercent |
| `PmActivityProgress` | Activity-level progress update | ProgressEntryId, ScheduleActivityId, PercentComplete, InstalledQuantity, Unit, EarnedHours |
| `PmCostCodeProgress` | Cost-code-level progress | ProgressEntryId, CostCodeId, PhaseId, PercentComplete, EarnedValueAmount |
| `PmProgressEntry` | Progress update container | ProjectId, ProgressDate, EnteredByUserId, EntryType (Activity/CostCode/Quantity/EarnedValue), Status |
| `PmProgressTimeEntryLink` | Links progress to time entries | ProgressEntryId, TimeEntryId |

### 1.3 Enums Already Defined

```
ScheduleStatus: Draft, Active, Baselined, Archived
ScheduleCalendarType: Standard5x8, Standard6x10, Custom
ScheduleImportSource: Csv, P6Xml, MsProject
ScheduleActivityType: Wbs, Task, Milestone
ScheduleActivityStatus: NotStarted, InProgress, Completed, OnHold
ScheduleDependencyType: FS, FF, SS, SF
ScheduleBaselineType: Initial, ApprovedRevision, Recovery
ScheduleResourceType: Crew, Equipment, Subcontract
CalendarExceptionType: Holiday, WeatherShutdown, CompanyShutdown, Custom
ImportStatus: Queued, Processing, Succeeded, PartialSuccess, Failed
```

### 1.4 New Entities Required (Phase 2+)

These are NOT built in Phase 1. Listed here for architectural awareness.

| Entity | Phase | Purpose |
|--------|-------|---------|
| `PmLookAheadSchedule` | 2 | 3-week/6-week rolling look-ahead with filtered activities |
| `PmScheduleDelay` | 2 | Formal delay event with type (excusable/compensable/concurrent), impact analysis |
| `PmScheduleNarrative` | 2 | Monthly schedule narrative (auto-generated from deltas) |
| `PmResourcePool` | 3 | Company-wide resource definitions for leveling across projects |
| `PmWeatherRecord` | 3 | Historical weather data linked to calendar exceptions |

---

## 2) Core Feature: CPM Calculation Engine

### 2.1 What CPM Actually Does

The Critical Path Method computes four dates for every activity:

- **Early Start (ES):** Earliest possible start given predecessors
- **Early Finish (EF):** ES + Duration
- **Late Finish (LF):** Latest possible finish without delaying the project
- **Late Start (LS):** LF - Duration

From these, two critical values derive:

- **Total Float:** LS - ES (or LF - EF). How many days this activity can slip without delaying the project.
- **Free Float:** Min(successor ES values) - EF. How many days this activity can slip without delaying any successor.
- **Critical Path:** All activities where Total Float = 0 (or below a configurable threshold).

### 2.2 Forward Pass Algorithm

```
For each activity in topological order (predecessors before successors):
  1. ES = max(predecessor EF + lag) for all predecessors
     - FS: ES = predecessor.EF + lag
     - SS: ES = predecessor.ES + lag
     - FF: ES = predecessor.EF + lag - duration
     - SF: ES = predecessor.ES + lag - duration
  2. Apply calendar: skip non-working days (weekends, holidays, weather shutdowns)
  3. EF = ES + working_days(duration, calendar)
  4. For activities with no predecessors: ES = schedule.DataDate (or project start)
```

### 2.3 Backward Pass Algorithm

```
For each activity in reverse topological order (successors before predecessors):
  1. LF = min(successor LS - lag) for all successors
     - FS: LF = successor.LS - lag
     - SS: LF = successor.LS - lag + duration
     - FF: LF = successor.LF - lag
     - SF: LF = successor.LF - lag + duration
  2. Apply calendar: skip non-working days
  3. LS = LF - working_days(duration, calendar)
  4. For activities with no successors: LF = project end date
```

### 2.4 Float Calculation

```
Total Float = LS - ES (in working days)
Free Float = min(successor.ES) - EF (for FS relationships)
IsCritical = TotalFloat <= criticalThreshold (default: 0)
```

### 2.5 Calendar-Aware Date Arithmetic

The schedule respects three calendar types:

| Calendar | Working Days | Hours/Day |
|----------|-------------|-----------|
| Standard5x8 | Mon-Fri | 8 |
| Standard6x10 | Mon-Sat | 10 |
| Custom | Per exception table | Per exception |

**Non-working days** from `PmScheduleCalendarException` are skipped during date arithmetic. This is where weather delays are modeled: add a `WeatherShutdown` exception and the engine recalculates all downstream dates.

### 2.6 Implementation: `ICpmCalculationService`

```csharp
public interface ICpmCalculationService
{
    /// <summary>
    /// Runs forward + backward pass, updates ES/EF/LS/LF/float/critical for all activities.
    /// Returns the calculated project completion date.
    /// </summary>
    Task<CpmResult> CalculateAsync(Guid scheduleId, CancellationToken ct);
}

public record CpmResult(
    DateTime ProjectCompletionDate,
    int CriticalPathActivityCount,
    int TotalActivities,
    TimeSpan CalculationDuration,
    List<CpmWarning> Warnings  // circular dependencies, negative float, etc.
);
```

### 2.7 When CPM Runs

- **On import:** After P6 XML/CSV import completes
- **On activity update:** When duration, dates, or dependencies change (debounced, not per-keystroke)
- **On baseline capture:** To freeze the current calculated dates
- **On calendar change:** When weather days or holidays are added/removed
- **Manual trigger:** PM clicks "Recalculate Schedule"

### 2.8 Performance Target

- **500 activities, 1,500 dependencies:** < 200ms
- **2,000 activities, 6,000 dependencies:** < 1 second
- **5,000+ activities:** Background job with progress indicator

The algorithm is O(V + E) for topological sort + forward/backward pass. The calendar date arithmetic is the bottleneck -- pre-compute a working-day lookup table per calendar to avoid repeated iteration.

---

## 3) Core Feature: Gantt Chart Visualization

See `docs/plans/GANTT-CHART-VISUALIZATION.md` for the complete frontend spec. Summary:

**Decision:** Custom SVG + date-fns. No commercial libraries (licensing risk).

**Key capabilities:**
- Zoom: day / week / month / quarter
- WBS tree collapse/expand (left pane)
- Activity bars with percent-complete fill
- Critical path highlighting (red bars)
- Milestone diamonds
- FS/FF/SS/SF dependency arrows with routing
- Data date vertical line
- Baseline comparison (ghost bars behind actual)
- Hover tooltips with activity details
- Virtual scrolling for 500+ activities

**API endpoint:** `GET /api/projects/{projectId}/schedule/{scheduleId}/gantt`
Returns all activities + dependencies in a single response (no pagination -- schedules are typically < 5,000 rows).

---

## 4) Core Feature: Schedule Import (P6, MS Project, CSV)

### 4.1 Why Import Matters

Most GCs already have schedules in P6 or MS Project. They will not re-enter 500 activities manually. Import is the on-ramp to adoption. If import doesn't work smoothly, the module is dead on arrival.

### 4.2 P6 XML Import (XER is deprecated, XML is current)

P6 exports XML with a well-defined schema. Key mappings:

| P6 XML Element | Pitbull Entity Field |
|----------------|---------------------|
| `<Activity>/<Id>` | ActivityCode |
| `<Activity>/<Name>` | Name |
| `<Activity>/<Type>` | ActivityType (TaskDependent → Task, StartMilestone → Milestone, WBS → Wbs) |
| `<Activity>/<PlannedStartDate>` | PlannedStart |
| `<Activity>/<PlannedFinishDate>` | PlannedFinish |
| `<Activity>/<ActualStartDate>` | ActualStart |
| `<Activity>/<ActualFinishDate>` | ActualFinish |
| `<Activity>/<OriginalDuration>` | OriginalDurationDays (convert from hours: / 8) |
| `<Activity>/<RemainingDuration>` | RemainingDurationDays |
| `<Activity>/<PhysicalPercentComplete>` | PercentComplete |
| `<Activity>/<IsCritical>` | IsCritical |
| `<WBS>/<Code>` | WbsCode (hierarchical, build ParentActivityId tree) |
| `<Relationship>/<Type>` | DependencyType (Finish_Start → FS, etc.) |
| `<Relationship>/<Lag>` | LagDays (convert from hours) |
| `<Calendar>/<HolidayOrException>` | PmScheduleCalendarException |

### 4.3 MS Project XML Import

Microsoft Project exports `.mpp` (binary) and `.xml`. We support XML only in Phase 1.

| MS Project Element | Pitbull Field |
|--------------------|---------------|
| `<Task>/<UID>` | ActivityCode |
| `<Task>/<Name>` | Name |
| `<Task>/<Start>` | PlannedStart |
| `<Task>/<Finish>` | PlannedFinish |
| `<Task>/<Duration>` | OriginalDurationDays (parse ISO 8601 duration) |
| `<Task>/<PercentComplete>` | PercentComplete |
| `<Task>/<OutlineLevel>` | WBS hierarchy depth |
| `<Task>/<Milestone>` | ActivityType = Milestone |
| `<PredecessorLink>/<Type>` | DependencyType (1=FF, 0=FS, 2=SF, 3=SS) |

### 4.4 CSV Import (Simple)

For schedulers who export from spreadsheets or lightweight tools:

Required columns: `ActivityCode, Name, Duration, PlannedStart, PlannedFinish`
Optional: `WbsCode, Predecessor, DependencyType, Lag, PercentComplete, ActualStart, ActualFinish`

### 4.5 Import Service Interface

```csharp
public interface IScheduleImportService
{
    Task<ScheduleImportResult> ImportP6XmlAsync(Guid projectId, Stream xmlStream, ImportOptions options, CancellationToken ct);
    Task<ScheduleImportResult> ImportMsProjectXmlAsync(Guid projectId, Stream xmlStream, ImportOptions options, CancellationToken ct);
    Task<ScheduleImportResult> ImportCsvAsync(Guid projectId, Stream csvStream, ImportOptions options, CancellationToken ct);
}

public record ImportOptions(
    bool ReplaceExisting = false,        // Replace current schedule vs. create new
    bool ImportCalendar = true,          // Import calendar exceptions
    bool ImportResources = false,        // Import resource assignments (Phase 2)
    bool RunCpmAfterImport = true        // Auto-calculate CPM after import
);

public record ScheduleImportResult(
    Guid ScheduleId,
    Guid ImportLogId,
    int ActivitiesImported,
    int DependenciesImported,
    int CalendarExceptionsImported,
    int Warnings,
    List<ImportWarning> WarningDetails
);
```

### 4.6 Import Validation

Before committing an import:
1. **Circular dependency check:** Topological sort must succeed. If not, reject with specific cycle path.
2. **Orphan activity check:** Activities referencing non-existent predecessors/successors.
3. **Date sanity:** Start > Finish, negative durations, dates before project start.
4. **Duplicate codes:** Two activities with the same ActivityCode within one schedule.

---

## 5) Core Feature: Baseline Management

### 5.1 What Baselines Are

A baseline is a frozen snapshot of the schedule at a point in time. The original baseline (captured at project start) is the benchmark. Every monthly update is compared against it.

**Why baselines matter:**
- Owner contracts require baseline schedule submission before work starts
- Monthly schedule updates are compared to baseline to show slippage
- Delay claims compare current schedule to baseline to prove impact
- Earned value calculations use baseline dates for BCWS (planned value)

### 5.2 Baseline Types

| Type | When | Purpose |
|------|------|---------|
| `Initial` | Project start, after owner approval | Contractual baseline. The "promise." |
| `ApprovedRevision` | After major scope change or recovery | Re-baselined with owner approval. |
| `Recovery` | When project is behind | Accelerated plan to recover schedule. |

### 5.3 Baseline Operations

```csharp
public interface IBaselineService
{
    /// Captures current schedule state as a new baseline
    Task<PmScheduleBaseline> CaptureBaselineAsync(Guid scheduleId, string name, ScheduleBaselineType type, CancellationToken ct);

    /// Compares current schedule against a baseline, returns per-activity deltas
    Task<BaselineComparisonResult> CompareToBaselineAsync(Guid scheduleId, Guid baselineId, CancellationToken ct);
}

public record BaselineComparisonResult(
    Guid BaselineId,
    string BaselineName,
    int TotalActivities,
    int DelayedActivities,           // Current finish > baseline finish
    int AheadActivities,             // Current finish < baseline finish
    int OnTrackActivities,
    int DaysOverall,                 // Project finish delta vs baseline
    List<ActivityDelta> Deltas
);

public record ActivityDelta(
    Guid ActivityId,
    string ActivityCode,
    string Name,
    DateTime? BaselineStart,
    DateTime? BaselineFinish,
    DateTime? CurrentStart,
    DateTime? CurrentFinish,
    int StartDeltaDays,
    int FinishDeltaDays,
    string Status                    // "Ahead", "OnTrack", "Delayed", "Critical"
);
```

### 5.4 Gantt Baseline Display

Baseline bars render as thin gray "ghost bars" behind the current activity bars. This is the universal visual language for baseline comparison in construction scheduling.

---

## 6) Core Feature: Look-Ahead Schedules

### 6.1 What a Look-Ahead Is

A look-ahead (also called "short-interval schedule" or "rolling wave") is a filtered, detailed view of the next 2-6 weeks of work. It is the primary scheduling tool used in weekly subcontractor coordination meetings.

**The weekly rhythm:**
1. Monday: PM generates 3-week look-ahead from the master schedule
2. Tuesday: PM reviews with superintendent, adjusts for field reality
3. Wednesday: Subcontractor coordination meeting -- everyone gets the look-ahead
4. Thursday-Friday: Subs plan their crews based on look-ahead dates
5. Following Monday: PM updates progress, generates next look-ahead

### 6.2 Look-Ahead Generation (Phase 1: Server-Side Filter)

In Phase 1, the look-ahead is a filtered view of the master schedule, not a separate entity. The API returns activities within a date window with additional detail useful for weekly meetings.

```
GET /api/projects/{projectId}/schedule/{scheduleId}/look-ahead
  ?weeks=3
  &includeCompleted=false
  &filterByTrade={costCodeId}
  &filterBySubcontractor={subcontractId}
```

Response includes:
- Activities within the date window (by EarlyStart or PlannedStart)
- Their predecessors (even if outside the window) to show what's blocking them
- Resource assignments (who is doing this work)
- Related submittals and RFIs (blockers)

### 6.3 Look-Ahead PDF Export

The look-ahead is commonly printed and handed out at coordination meetings. The PDF includes:
- Week headers (Week of Jan 6, Week of Jan 13, Week of Jan 20)
- Activities grouped by trade/cost code
- Responsible sub for each activity
- Status indicators (on track, behind, critical)
- Related open RFIs/submittals that could block the work

---

## 7) Core Feature: Weather Delay Tracking

### 7.1 How Weather Delays Work

Weather is the most common delay on construction projects. The contract typically defines "weather days" -- the number of expected lost weather days per month. Exceeding the contractual allowance entitles the contractor to a time extension.

**Example:** Contract allows 3 weather days in January. It rains 5 days. Contractor is entitled to 2-day time extension (5 - 3 = 2 excess weather days).

### 7.2 Weather Day Tracking via Calendar Exceptions

Weather days are recorded as `PmScheduleCalendarException` with `ExceptionType = WeatherShutdown`. When a weather day is added:

1. The calendar exception is recorded with the date
2. CPM recalculates -- all activities affected by that day shift
3. The Gantt chart visually reflects the new dates
4. The weather day count is tracked against contractual allowances

### 7.3 Weather Day Impact Report

```
GET /api/projects/{projectId}/schedule/{scheduleId}/weather-impact
```

Returns:
- Total weather days recorded (by month)
- Contractual weather day allowance (from project settings)
- Excess weather days entitled to time extension
- Net schedule impact (days the project completion moved due to weather)
- Activities directly impacted by each weather day

### 7.4 Future: Automated Weather Integration (Phase 3)

In Phase 3, integrate with a weather API (OpenWeather, NOAA) to:
- Auto-flag days where conditions exceeded thresholds (rain > 0.5", wind > 30mph, temp < 20F)
- Suggest calendar exceptions based on actual weather
- PM confirms or dismisses -- never auto-adds without human review

---

## 8) Core Feature: Schedule Narratives

### 8.1 What a Schedule Narrative Is

A schedule narrative is a written report accompanying the monthly schedule update. It explains what changed, why, and what the impact is. Required on most commercial projects for the monthly OAC (Owner/Architect/Contractor) meeting.

**Typical narrative sections:**
1. Executive summary (1 paragraph)
2. Key accomplishments this period
3. Activities started / completed
4. Critical path changes
5. Float consumption analysis
6. Delay events and impact
7. Look-ahead (key activities next period)
8. Recovery plan (if behind schedule)

### 8.2 AI-Generated Narrative Drafts

The entity `PmProjectNarrative` already exists with fields for ExecutiveSummary, KeyAccomplishments, UpcomingMilestones, RisksAndConcerns, and ScheduleSummary. The `GeneratedDraftText` field is designed for AI-generated content.

**AI input data for narrative generation:**
- Schedule delta: current vs. prior update (activities started, completed, delayed)
- Critical path changes: new critical activities, activities leaving critical path
- Float consumption: activities that lost float since last update
- Weather days recorded
- Open RFIs and submittals that are blocking activities
- Baseline comparison: overall project slippage
- Earned value metrics: SPI, CPI trends

**AI output:** A structured narrative draft that the PM reviews, edits, and approves. Never auto-published.

### 8.3 Narrative Lifecycle

```
Draft → Submitted → Approved → Published
          ↓
        (Revision loop with PmProjectNarrativeRevision)
```

---

## 9) Core Feature: Earned Value Management (EVM)

### 9.1 EVM in Construction

Earned Value Management connects schedule progress to cost performance. It answers: "Are we getting the value we're paying for?"

**The three fundamental measurements:**

| Metric | Name | Formula | What It Tells You |
|--------|------|---------|-------------------|
| BCWS | Budgeted Cost of Work Scheduled (Planned Value) | Budget for activities that SHOULD be done by now (per baseline schedule) | What we planned to spend |
| BCWP | Budgeted Cost of Work Performed (Earned Value) | Budget for activities actually COMPLETED | What we earned |
| ACWP | Actual Cost of Work Performed (Actual Cost) | What we actually spent on completed work | What we spent |

**Derived metrics:**

| Metric | Formula | Interpretation |
|--------|---------|----------------|
| SPI (Schedule Performance Index) | BCWP / BCWS | < 1.0 = behind schedule, > 1.0 = ahead |
| CPI (Cost Performance Index) | BCWP / ACWP | < 1.0 = over budget, > 1.0 = under budget |
| SV (Schedule Variance) | BCWP - BCWS | Negative = behind schedule |
| CV (Cost Variance) | BCWP - ACWP | Negative = over budget |
| EAC (Estimate at Completion) | Budget / CPI | Projected final cost based on current efficiency |
| VAC (Variance at Completion) | Budget - EAC | Projected final cost overrun/underrun |

### 9.2 How EV Connects to Schedule Entities

The connection between schedule and cost is through **CostCodeId** on `PmScheduleActivity`:

1. Each schedule activity can link to a cost code via `CostCodeId`
2. The cost code has a budget (`PmJobCostBudget.CurrentBudget`)
3. The activity has percent complete (`PmScheduleActivity.PercentComplete`)
4. BCWP = PercentComplete x Budget (for that cost code)
5. BCWS comes from the baseline: what percent complete SHOULD we be by the data date?
6. ACWP comes from job cost actuals (`PmJobCostActual.TotalActualCost`)

### 9.3 EV Snapshot Service

```csharp
public interface IEarnedValueService
{
    /// Calculates and stores EV metrics for a project as of a given date
    Task<PmEarnedValueSnapshot> CalculateAndSnapshotAsync(Guid projectId, DateTime asOfDate, CancellationToken ct);

    /// Generates S-curve data points for plotting
    Task<List<PmSCurvePoint>> GenerateSCurveAsync(Guid projectId, CancellationToken ct);

    /// Gets EV trend over time for dashboard display
    Task<List<PmEarnedValueSnapshot>> GetTrendAsync(Guid projectId, int months, CancellationToken ct);
}
```

### 9.4 S-Curve Visualization

The S-curve is the universal visual for project health. It plots three lines over time:

- **Planned (BCWS):** The baseline plan -- always an S-shape because projects start slow, ramp up, then taper off
- **Earned (BCWP):** What was actually completed (value earned)
- **Actual (ACWP):** What was actually spent

When the Earned line falls below the Planned line, the project is behind schedule. When the Actual line rises above the Earned line, the project is over budget.

---

## 10) Core Feature: Resource Leveling

### 10.1 What Resource Leveling Does

Resource leveling adjusts activity dates to resolve resource over-allocation. If you have 2 concrete crews but 4 pours scheduled the same week, something has to move.

**Construction resource types:**
- **Crews:** Groups of workers by trade (concrete, electrical, plumbing)
- **Equipment:** Cranes, excavators, pumps (limited quantity, expensive idle time)
- **Subcontractors:** External companies with limited capacity

### 10.2 Leveling Algorithm (Phase 2)

Phase 1 does NOT include automatic resource leveling. Activities display resource assignments (via `PmScheduleResourceAssignment`) and the system shows over-allocation warnings, but does not auto-resolve.

Phase 2 adds a heuristic leveling algorithm:

1. Identify over-allocated resources per time period
2. For each conflict, identify the activity with the most total float
3. Delay that activity within its float (it won't affect the critical path)
4. If no float is available, flag the conflict for manual resolution

```csharp
public interface IResourceLevelingService
{
    /// Identifies resource conflicts without modifying the schedule
    Task<List<ResourceConflict>> IdentifyConflictsAsync(Guid scheduleId, CancellationToken ct);

    /// Attempts to resolve conflicts by delaying non-critical activities
    Task<LevelingResult> LevelAsync(Guid scheduleId, LevelingOptions options, CancellationToken ct);
}
```

### 10.3 Resource Histogram

The frontend displays a stacked bar chart showing resource usage over time:
- X-axis: weeks
- Y-axis: resource units (crew count or equipment count)
- Bars: stacked by project (for multi-project view) or by trade (for single project)
- Red line: capacity limit
- Red bars: over-allocation periods

---

## 11) Integration Points

### 11.1 Schedule ↔ Cost (Job Cost Module)

| Direction | What | How |
|-----------|------|-----|
| Schedule → Cost | Activity completion drives earned value | `PmScheduleActivity.CostCodeId` links to `PmJobCostBudget`. PercentComplete × Budget = BCWP |
| Cost → Schedule | Actual costs feed EV metrics | `PmJobCostActual.TotalActualCost` by CostCodeId = ACWP |
| Schedule → Cost | Resource hours drive labor cost projections | `PmScheduleResourceAssignment.PlannedHours` → estimated labor cost per activity |

### 11.2 Schedule ↔ RFIs / Submittals

| Direction | What | How |
|-----------|------|-----|
| RFI → Schedule | RFI delay impacts schedule | `RfiCostImpactLink.EstimatedDays` → calendar exception or activity duration increase |
| Submittal → Schedule | Submittal approval gates activity start | `PmSubmittal.ScheduleActivityId` links submittal to activity. Late submittal = late activity start |
| Schedule → Submittal | Required-by date derived from schedule | Activity start date minus lead time = submittal required-by date |

### 11.3 Schedule ↔ Change Orders

| Direction | What | How |
|-----------|------|-----|
| CO → Schedule | Approved CO may extend schedule | Time extension from change order → adjust activity durations or add activities |
| Schedule → CO | Schedule delay may trigger CO | Delay analysis identifies owner-caused delays → generates time extension CO |

### 11.4 Schedule ↔ Daily Reports

| Direction | What | How |
|-----------|------|-----|
| Daily Report → Schedule | Field progress updates schedule | `PmDailyReportCrew.HoursWorked` by trade → progress on related activities |
| Daily Report → Schedule | Weather events → calendar exceptions | `PmDailyReport.WeatherSummary` with rain/snow → `WeatherShutdown` exception |
| Schedule → Daily Report | Planned activities show in daily report template | Today's scheduled activities pre-populate the daily report |

### 11.5 Schedule ↔ Billing (WIP)

| Direction | What | How |
|-----------|------|-----|
| Schedule → WIP | Schedule % complete feeds WIP calculation | When WIP method = "cost-to-cost", the schedule's percent complete is one validation input against cost-based % complete |
| Schedule → Billing | SOV line progress from schedule | Activities linked to SOV lines via cost codes can drive billing progress |

### 11.6 Schedule ↔ Notifications

| Event | Notification |
|-------|-------------|
| Activity falls behind baseline by > N days | Alert PM |
| Critical path changes | Alert PM + Superintendent |
| Resource over-allocation detected | Alert PM |
| Weather day added, project completion moves | Alert PM + Owner (configurable) |
| Float consumed below threshold | Alert PM |
| Look-ahead generated | Notify subcontractors (Phase 3) |

---

## 12) API Design

### 12.1 Schedule CRUD

```
POST   /api/projects/{projectId}/schedules                    Create schedule
GET    /api/projects/{projectId}/schedules                    List schedules for project
GET    /api/projects/{projectId}/schedules/{scheduleId}       Get schedule details
PUT    /api/projects/{projectId}/schedules/{scheduleId}       Update schedule metadata
DELETE /api/projects/{projectId}/schedules/{scheduleId}       Soft delete
```

### 12.2 Activities

```
GET    /api/projects/{projectId}/schedules/{id}/activities           List all (flat or tree)
POST   /api/projects/{projectId}/schedules/{id}/activities           Create activity
PUT    /api/projects/{projectId}/schedules/{id}/activities/{actId}   Update activity
DELETE /api/projects/{projectId}/schedules/{id}/activities/{actId}   Soft delete
PATCH  /api/projects/{projectId}/schedules/{id}/activities/{actId}/progress   Update % complete
```

### 12.3 Dependencies

```
GET    /api/projects/{projectId}/schedules/{id}/dependencies                   List all
POST   /api/projects/{projectId}/schedules/{id}/dependencies                   Create
DELETE /api/projects/{projectId}/schedules/{id}/dependencies/{depId}            Delete
```

### 12.4 CPM & Calculation

```
POST   /api/projects/{projectId}/schedules/{id}/calculate          Run CPM
GET    /api/projects/{projectId}/schedules/{id}/critical-path      Get critical path activities
```

### 12.5 Baselines

```
POST   /api/projects/{projectId}/schedules/{id}/baselines                    Capture baseline
GET    /api/projects/{projectId}/schedules/{id}/baselines                    List baselines
GET    /api/projects/{projectId}/schedules/{id}/baselines/{blId}/compare     Compare to baseline
```

### 12.6 Gantt (Combined Endpoint)

```
GET    /api/projects/{projectId}/schedules/{id}/gantt              All activities + deps + baselines
```

### 12.7 Look-Ahead

```
GET    /api/projects/{projectId}/schedules/{id}/look-ahead?weeks=3   Filtered view
GET    /api/projects/{projectId}/schedules/{id}/look-ahead/pdf       PDF export
```

### 12.8 Import

```
POST   /api/projects/{projectId}/schedules/import                   Upload P6/MSP/CSV
GET    /api/projects/{projectId}/schedules/import-logs               Import history
```

### 12.9 Earned Value

```
POST   /api/projects/{projectId}/earned-value/snapshot              Generate EV snapshot
GET    /api/projects/{projectId}/earned-value/snapshots              List snapshots
GET    /api/projects/{projectId}/earned-value/s-curve                S-curve data points
GET    /api/projects/{projectId}/earned-value/trend?months=6         EV trend over time
```

### 12.10 Calendar & Weather

```
GET    /api/projects/{projectId}/schedules/{id}/calendar             Calendar exceptions
POST   /api/projects/{projectId}/schedules/{id}/calendar             Add exception
DELETE /api/projects/{projectId}/schedules/{id}/calendar/{excId}      Remove exception
GET    /api/projects/{projectId}/schedules/{id}/weather-impact        Weather day impact report
```

### 12.11 Resource Assignments

```
GET    /api/projects/{projectId}/schedules/{id}/resources                     List assignments
POST   /api/projects/{projectId}/schedules/{id}/resources                     Create assignment
PUT    /api/projects/{projectId}/schedules/{id}/resources/{resId}             Update assignment
GET    /api/projects/{projectId}/schedules/{id}/resources/histogram           Resource histogram data
GET    /api/projects/{projectId}/schedules/{id}/resources/conflicts           Over-allocation report
```

---

## 13) Database Considerations

### 13.1 Existing Tables (No Migration Needed for Phase 1)

All schedule entities already have EF configurations. Tables:
- `pm_schedules`
- `pm_schedule_activities`
- `pm_schedule_dependencies`
- `pm_schedule_baselines`
- `pm_schedule_baseline_activities`
- `pm_schedule_resource_assignments`
- `pm_schedule_calendar_exceptions`
- `pm_schedule_import_logs`
- `pm_earned_value_snapshots`
- `pm_s_curve_points`
- `pm_activity_progress`
- `pm_cost_code_progress`
- `pm_progress_entries`

### 13.2 Index Strategy

Key indexes for schedule queries:

```sql
-- Activity lookup by schedule (most common query)
CREATE INDEX IX_pm_schedule_activities_schedule ON pm_schedule_activities (TenantId, CompanyId, ScheduleId);

-- Critical path filter
CREATE INDEX IX_pm_schedule_activities_critical ON pm_schedule_activities (ScheduleId, IsCritical) WHERE "IsCritical" = true;

-- Dependency lookup by predecessor/successor
CREATE INDEX IX_pm_schedule_dependencies_pred ON pm_schedule_dependencies (PredecessorActivityId);
CREATE INDEX IX_pm_schedule_dependencies_succ ON pm_schedule_dependencies (SuccessorActivityId);

-- EV snapshots by project + date (for trend queries)
CREATE INDEX IX_pm_earned_value_snapshots_trend ON pm_earned_value_snapshots (TenantId, CompanyId, ProjectId, SnapshotDate DESC);

-- Calendar exceptions by schedule + date range (for CPM date arithmetic)
CREATE INDEX IX_pm_schedule_calendar_exceptions_range ON pm_schedule_calendar_exceptions (ScheduleId, Date);
```

### 13.3 Query Patterns

| Query | Expected Volume | Strategy |
|-------|----------------|----------|
| Load all activities for Gantt | 500-5,000 rows | Single query, no pagination, `.AsNoTracking()` |
| Load dependencies for CPM | 1,500-15,000 rows | Single query with activity IDs |
| Calendar exceptions for date math | 50-200 rows/year | Load once, cache for CPM run |
| EV trend (6 months) | 6 rows | Simple indexed query |
| Look-ahead filter (3 weeks) | 50-200 rows | Date range filter on EarlyStart |

---

## 14) Frontend Pages

### 14.1 Page Map

| Page | Route | Purpose |
|------|-------|---------|
| Schedule List | `/projects/{id}/schedule` | List all schedules for a project (most projects have one) |
| Schedule Detail | `/projects/{id}/schedule/{schedId}` | Gantt chart + activity table (primary workspace) |
| Import | `/projects/{id}/schedule/import` | Upload P6 XML / MS Project XML / CSV |
| Baselines | `/projects/{id}/schedule/{schedId}/baselines` | List baselines, capture new, compare |
| Look-Ahead | `/projects/{id}/schedule/{schedId}/look-ahead` | 3/6-week rolling schedule |
| Earned Value | `/projects/{id}/earned-value` | S-curve chart, EV metrics, trend |
| Calendar | `/projects/{id}/schedule/{schedId}/calendar` | Weather days, holidays, exceptions |
| Resource View | `/projects/{id}/schedule/{schedId}/resources` | Resource histogram, conflict view |

### 14.2 Schedule Detail Page (Primary Workspace)

This is the "P6 killer" page. Split-pane layout:

**Left pane (40%):** Activity tree table
- Columns: WBS/Activity Code, Name, Duration, Start, Finish, % Complete, Float, Status
- Collapsible WBS hierarchy
- Inline editing for % complete and dates (Phase 2)
- Row coloring: red = critical, yellow = near-critical (float < 5 days), gray = completed

**Right pane (60%):** Gantt timeline (SVG)
- Time header with zoom levels
- Activity bars with % complete fill
- Baseline ghost bars (toggleable)
- Dependency arrows
- Data date line
- Today line

**Toolbar:**
- Zoom: Day / Week / Month / Quarter
- Filter: Critical path only, by trade, by sub, by WBS
- Actions: Recalculate CPM, Capture Baseline, Export PDF, Import
- Toggle: Show baseline, show dependencies, show float

### 14.3 Earned Value Dashboard

Three-panel layout:

**Panel 1: S-Curve Chart**
- Three lines: Planned (BCWS), Earned (BCWP), Actual (ACWP)
- X-axis: project timeline (monthly)
- Y-axis: cumulative cost/value
- Shaded area between lines shows variance

**Panel 2: KPI Cards**
- SPI with trend indicator (up/down arrow + color)
- CPI with trend indicator
- EAC vs. Budget
- VAC (projected overrun/underrun)
- Percent complete (schedule vs. cost)

**Panel 3: EV Trend Table**
- Month-by-month BCWS, BCWP, ACWP, SPI, CPI
- Color coding: red < 0.9, yellow 0.9-1.0, green > 1.0

---

## 15) What Makes Us Different from P6

| Capability | P6 | Pitbull |
|-----------|-----|---------|
| **CPM engine** | Proven, trusted | Same algorithm, open-source, auditable |
| **Price** | $3-5K/user/year | Included in ERP subscription |
| **Deployment** | Oracle DB + WebLogic or desktop install | Web-based, no install |
| **Mobile** | None (seriously) | Responsive web, works on iPad |
| **Integration** | SOAP API, XER export | REST API, real-time connection to cost, billing, RFIs, submittals |
| **Collaboration** | Single-user, file locking | Multi-user, real-time (Phase 2) |
| **Cost connection** | Manual export to accounting system | EV calculated live from job cost actuals |
| **RFI/Submittal** | Separate system (Procore, Bluebeam) | Same system -- submittal links to activity, late submittal auto-flags schedule risk |
| **Billing** | No connection | Schedule progress drives SOV billing |
| **Daily reports** | No connection | Weather in daily report → calendar exception → CPM recalculates |
| **AI** | None | Narrative generation, delay prediction, schedule optimization suggestions |
| **Look-ahead** | Manual filter + print | Auto-generated, PDF export, sub notification |
| **Weather** | Manual calendar entry | Auto-suggest from weather API (Phase 3), contractual allowance tracking |

**The killer advantage:** In P6, the schedule is an island. In Pitbull, the schedule is connected to everything. When a submittal is late, the linked activity's start date reflects it. When it rains, the daily report logs it and the schedule recalculates. When the PM approves a change order with a time extension, the schedule adjusts. This is what "the AI is the architecture" means -- the system understands cause and effect across modules.

---

## 16) Implementation Phases

### Phase 1: Foundation (This Spec)

1. CPM Calculation Service (`ICpmCalculationService`)
2. Schedule Import Service (P6 XML, MS Project XML, CSV)
3. Gantt Chart Visualization (see Gantt spec)
4. Baseline capture + comparison
5. Calendar exception management (weather days)
6. Schedule CRUD endpoints
7. Look-ahead endpoint (filtered view, no separate entity)
8. Unit tests for CPM algorithm (forward pass, backward pass, all 4 dependency types, calendar math)
9. Frontend: Schedule Detail page, Import page, Calendar page

### Phase 2: Intelligence

1. Look-ahead as first-class entity with sub notifications
2. AI-generated schedule narratives
3. Resource conflict detection + manual resolution UI
4. Inline Gantt editing (drag bars, modify durations)
5. Schedule delay entity for formal delay tracking
6. Real-time multi-user editing (WebSocket)

### Phase 3: Optimization

1. Resource leveling algorithm
2. Weather API integration (OpenWeather/NOAA)
3. AI schedule optimization suggestions ("if you move activity X, critical path shortens by 3 days")
4. Multi-project resource view (portfolio level)
5. Forensic delay analysis (TIA - Time Impact Analysis)
6. P6 XER export (for contractual submissions that require P6 format)

---

## 17) Acceptance Criteria

1. PM can import a P6 XML schedule (500 activities, 1,500 dependencies) in < 30 seconds
2. CPM calculation produces correct ES/EF/LS/LF/float for all 4 dependency types with lag
3. Gantt chart renders 500+ activities with virtual scrolling at 60fps
4. Baseline comparison shows per-activity start/finish deltas
5. Weather day added to calendar → CPM recalculates → affected activities shift → Gantt updates
6. Look-ahead returns activities within date window with related submittals/RFIs
7. Earned value snapshot calculates correct BCWS/BCWP/ACWP/SPI/CPI from schedule + cost data
8. S-curve renders planned vs. earned vs. actual over project timeline
9. Schedule activities with CostCodeId link to job cost budget for EV calculations
10. Import validates circular dependencies before committing

---

## 18) Open Decisions

1. **CPM implementation language:** Pure C# in the service layer, or a separate calculation worker for large schedules (> 5,000 activities)?
2. **Calendar handling:** Build a reusable `IWorkingDayCalculator` or inline the logic in the CPM service?
3. **Gantt library:** The Gantt spec chose custom SVG. Should we reconsider for Phase 2 inline editing, or keep custom?
4. **Resource leveling priority:** When two activities compete for the same resource, use total float (standard) or a PM-assigned priority override?
5. **EV snapshot frequency:** Monthly (standard) or configurable per project?
6. **P6 export:** Phase 3 lists XER export. XER is undocumented/proprietary. Export as P6 XML instead?

---

*Addresses Executive Review concern C1 (VP of Construction, VP of Sales): "The single most visually impactful missing feature."*
*References existing spec: `docs/plans/GANTT-CHART-VISUALIZATION.md` for Phase 1 frontend.*
