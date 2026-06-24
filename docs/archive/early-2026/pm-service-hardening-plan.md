# PM Service Hardening Plan

## Overview

This plan adds business logic validation to the ProjectManagement module services. Currently, all services are thin CRUD wrappers that delegate to `PmServiceBase.CreateAsync/UpdateAsync/DeleteAsync` with no domain enforcement. Each section below specifies exact changes for each service method.

**Constraints:**
- Interface signatures in `Interfaces.cs` MUST NOT change
- Entity definitions in `ProjectManagementEntities.cs` MUST NOT change
- No new EF migrations
- All existing tests MUST continue to pass
- Use inline `Result.Failure()` -- not FluentValidation
- Changes are limited to `Services.cs`

**Pattern reference:** `TimeEntryService.cs` shows the target pattern -- validate state before mutation, use `Result.Failure<T>(message, "ERROR_CODE")`, enforce status transitions via a private helper.

---

## Important: Existing Test Compatibility

Several existing tests create entities with arbitrary status values (e.g., `CreateSubmittalAsync` with `Status: "InReview"`, `UpdateSubmittalAsync` setting `Status: "Approved"` directly). The new business logic MUST NOT break these by rejecting status values set via generic `ApplyUpsert`.

**Strategy:** Status transition enforcement applies ONLY to dedicated action methods (`SubmitDailyReportAsync`, `ApproveDailyReportAsync`, `SubmitNarrativeAsync`, etc.) and to explicit `UpdateAsync` overrides where the current status is checked. The base `CreateAsync` and `UpdateAsync` methods in `PmServiceBase` remain unchanged -- they continue to accept any valid enum string via `ApplyUpsert`. All new validation goes into service-level method overrides that call the base AFTER validation, or into action methods that already load entities directly.

---

## 1. SubmittalService

**File:** `Services.cs`, class `SubmittalService` (line ~465)

### 1.1 `CreateSubmittalAsync` -- Override with auto-increment + defaults

**Replace** the one-liner delegation with a full method body:

```
1. Query max SubmittalNumber for this projectId:
   var maxNumber = await ProjectScoped<PmSubmittal>(projectId)
       .MaxAsync(s => (int?)s.SubmittalNumber, ct) ?? 0;
2. Set data["SubmittalNumber"] = maxNumber + 1 (merge into request.Data)
3. Force Status to "Draft" if not provided (set request = request with { Status = "Draft" })
4. Call base CreateAsync<PmSubmittal>(projectId, enrichedRequest, ct)
5. Return result
```

**Error codes:** None new (base handles NOT_FOUND)

### 1.2 `UpdateSubmittalAsync` -- Override with status-aware guard

**Replace** the one-liner delegation:

```
1. Load entity: var submittal = await ProjectScoped<PmSubmittal>(projectId).FirstOrDefaultAsync(s => s.Id == submittalId, ct)
2. If null: return Result.Failure<PmEntityDto>("Not found", "NOT_FOUND")
3. If submittal.Status == SubmittalStatus.Closed:
   return Result.Failure<PmEntityDto>("Cannot edit a closed submittal", "INVALID_STATUS")
4. If request.Status is provided and is a status change, validate transition:
   Valid transitions (from -> to):
   - Draft -> Submitted
   - Submitted -> InReview
   - InReview -> Approved, ApprovedAsNoted, ReviseAndResubmit, Rejected
   - ReviseAndResubmit -> Draft (resubmission cycle)
   - Approved/ApprovedAsNoted/Rejected -> Closed
   If invalid: return Result.Failure<PmEntityDto>("Invalid status transition from {from} to {to}", "INVALID_STATUS")
5. If transitioning to Submitted: set SubmittedDate = DateTime.UtcNow via Data merge
6. If transitioning to Approved/ApprovedAsNoted/ReviseAndResubmit/Rejected: set ReturnedDate = DateTime.UtcNow via Data merge
7. If transitioning to ReviseAndResubmit: increment RevisionNumber via Data merge
8. Call ApplyUpsert(entity, request), set entity.UpdatedAt, save, return ToDto
```

**Error codes:** `INVALID_STATUS`

### 1.3 `AddWorkflowEventAsync` -- Override with auto-populate

**Replace** the one-liner delegation:

```
1. Load submittal: var submittal = await ProjectScoped<PmSubmittal>(projectId).FirstOrDefaultAsync(s => s.Id == submittalId, ct)
2. If null: return Result.Failure<PmEntityDto>("Submittal not found", "NOT_FOUND")
3. Merge into request.Data:
   - "FromStatus" = submittal.Status.ToString()
   - "ActionAt" = DateTime.UtcNow
4. Call base CreateAsync<PmSubmittalWorkflowEvent>(projectId, request with { ReferenceId = submittalId }, ct)
```

**Error codes:** `NOT_FOUND`

---

## 2. DailyReportService

**File:** `Services.cs`, class `DailyReportService` (line ~574)

### 2.1 `CreateDailyReportAsync` -- Override with duplicate check

**Replace** the one-liner delegation:

```
1. Extract ReportDate and ReportType from request.Data (if provided)
   - Parse ReportDate from Data["ReportDate"] if present
   - Parse ReportType from Data["ReportType"] or request.Status context
2. If ReportDate is provided AND ReportType is provided:
   Check for duplicate: await ProjectScoped<PmDailyReport>(projectId)
       .AnyAsync(r => r.ReportDate.Date == reportDate.Date
           && r.ReportType == reportType, ct)
   If duplicate exists: return Result.Failure<PmEntityDto>(
       "A daily report already exists for this date and report type", "DUPLICATE_REPORT")
3. Call base CreateAsync<PmDailyReport>(projectId, request, ct)
```

**Error codes:** `DUPLICATE_REPORT`

### 2.2 `UpdateDailyReportAsync` -- Override with status guard

**Replace** the one-liner delegation:

```
1. Load entity: var report = await ProjectScoped<PmDailyReport>(projectId).FirstOrDefaultAsync(r => r.Id == dailyReportId, ct)
2. If null: return Result.Failure<PmEntityDto>("Not found", "NOT_FOUND")
3. If report.Status == DailyReportStatus.Approved || report.Status == DailyReportStatus.Locked:
   return Result.Failure<PmEntityDto>("Cannot edit an approved or locked daily report", "INVALID_STATUS")
4. Call ApplyUpsert(entity, request), set entity.UpdatedAt, save, return ToDto
```

**Error codes:** `INVALID_STATUS`

### 2.3 `SubmitDailyReportAsync` -- Add status transition + required field check

**Modify** existing method body (line ~585):

```
After loading dailyReport and null check:
1. If dailyReport.Status != DailyReportStatus.Draft:
   return Result.Failure<PmActionResultDto>(
       "Daily report can only be submitted from Draft status", "INVALID_STATUS")
2. If string.IsNullOrWhiteSpace(dailyReport.WorkNarrative):
   return Result.Failure<PmActionResultDto>(
       "WorkNarrative is required before submitting", "VALIDATION_ERROR")
3. Set status to Submitted, save (existing code)
```

**Error codes:** `INVALID_STATUS`, `VALIDATION_ERROR`

### 2.4 `ApproveDailyReportAsync` -- Add status transition guard

**Modify** existing method body (line ~596):

```
After loading dailyReport and null check:
1. If dailyReport.Status != DailyReportStatus.Submitted:
   return Result.Failure<PmActionResultDto>(
       "Daily report can only be approved from Submitted status", "INVALID_STATUS")
2. Set status to Approved, save (existing code)
```

**Error codes:** `INVALID_STATUS`

---

## 3. ScheduleService

**File:** `Services.cs`, class `ScheduleService` (line ~353)

### 3.1 `CreateScheduleAsync` -- Override with default status

**Replace** the one-liner delegation:

```
1. Force Status to "Draft" if not provided
2. Call base CreateAsync<PmSchedule>(projectId, enrichedRequest, ct)
```

### 3.2 `UpdateScheduleAsync` -- Override with status transition enforcement

**Replace** the one-liner delegation:

```
1. Load entity: var schedule = await ProjectScoped<PmSchedule>(projectId).FirstOrDefaultAsync(s => s.Id == scheduleId, ct)
2. If null: return Result.Failure<PmEntityDto>("Not found", "NOT_FOUND")
3. If request.Status is provided and different from current:
   Valid transitions:
   - Draft -> Active
   - Active -> Baselined
   - Active -> Archived
   - Baselined -> Archived
   If invalid: return Result.Failure<PmEntityDto>("Invalid status transition from {from} to {to}", "INVALID_STATUS")
4. Call ApplyUpsert, save, return ToDto
```

**Error codes:** `INVALID_STATUS`

### 3.3 `AddActivityAsync` -- Override with schedule-exists validation

The base already validates via `ReferenceId`, which is good. **Add** activity-belongs-to-schedule validation:

```
1. Validate schedule exists in project (already handled by ReferenceId validation in base)
2. Call base CreateAsync<PmScheduleActivity>(projectId, request with { ReferenceId = scheduleId }, ct)
```

No change needed -- base `ValidateReferenceProjectScopeAsync` handles this.

### 3.4 `AddDependencyAsync` -- Override with predecessor/successor validation

**Replace** the one-liner delegation:

```
1. Validate schedule exists: var schedule = await ProjectScoped<PmSchedule>(projectId).FirstOrDefaultAsync(s => s.Id == scheduleId, ct)
   If null: return NOT_FOUND
2. Extract PredecessorActivityId and SuccessorActivityId from request.Data
3. If PredecessorActivityId provided: validate it belongs to this schedule:
   await Db.Set<PmScheduleActivity>().AnyAsync(a => !a.IsDeleted && a.Id == predecessorId && a.ScheduleId == scheduleId, ct)
   If not found: return Result.Failure<PmEntityDto>("Predecessor activity not found in this schedule", "VALIDATION_ERROR")
4. If SuccessorActivityId provided: same check
   If not found: return Result.Failure<PmEntityDto>("Successor activity not found in this schedule", "VALIDATION_ERROR")
5. If predecessorId == successorId (and both provided):
   return Result.Failure<PmEntityDto>("Predecessor and successor cannot be the same activity", "VALIDATION_ERROR")
6. Call base CreateAsync<PmScheduleDependency>(projectId, request with { ReferenceId = scheduleId }, ct)
```

**Error codes:** `NOT_FOUND`, `VALIDATION_ERROR`

### 3.5 `RecalculateCriticalPathAsync` -- Add status guard

**Modify** existing method:

```
After loading schedule and null check:
1. If schedule.Status == ScheduleStatus.Archived:
   return Result.Failure<PmActionResultDto>("Cannot recalculate critical path on an archived schedule", "INVALID_STATUS")
2. Continue with existing logic
```

**Error codes:** `INVALID_STATUS`

---

## 4. JobCostService

**File:** `Services.cs`, class `JobCostService` (line ~434)

### 4.1 `CreateBudgetAsync` -- Override with duplicate check + computed field

**Replace** the one-liner delegation:

```
1. Extract CostCodeId from request.Data (or Guid.Empty if missing)
2. Extract PhaseId from request.Data (nullable)
3. If CostCodeId is Guid.Empty:
   return Result.Failure<PmEntityDto>("CostCodeId is required", "VALIDATION_ERROR")
4. Check duplicate: await ProjectScoped<PmJobCostBudget>(projectId)
       .AnyAsync(b => b.CostCodeId == costCodeId && b.PhaseId == phaseId, ct)
   If duplicate: return Result.Failure<PmEntityDto>(
       "A budget already exists for this project, cost code, and phase", "DUPLICATE_BUDGET")
5. Compute CurrentBudget: if request.Data contains OriginalBudget and ApprovedBudgetChanges,
   merge Data["CurrentBudget"] = OriginalBudget + ApprovedBudgetChanges
6. Call base CreateAsync<PmJobCostBudget>(projectId, enrichedRequest, ct)
```

**Error codes:** `VALIDATION_ERROR`, `DUPLICATE_BUDGET`

### 4.2 `UpdateBudgetAsync` -- Override with computed field

**Replace** the one-liner delegation:

```
1. Load entity: var budget = await ProjectScoped<PmJobCostBudget>(projectId).FirstOrDefaultAsync(b => b.Id == budgetId, ct)
2. If null: return NOT_FOUND
3. Apply upsert first (let fields get set)
4. Recompute: budget.CurrentBudget = budget.OriginalBudget + budget.ApprovedBudgetChanges
5. Save and return ToDto
```

### 4.3 `CreateForecastAsync` -- Override with computed field

**Replace** the one-liner delegation:

```
1. Call base CreateAsync<PmJobCostForecast>(projectId, request, ct)
2. If success, load the entity back and compute:
   forecast.VarianceToBudget = forecast.EstimatedFinalCost - (look up matching budget's CurrentBudget or 0)
   Actually, simpler: if request.Data has EstimatedFinalCost and a budget can be found:
   var budget = await ProjectScoped<PmJobCostBudget>(projectId)
       .FirstOrDefaultAsync(b => b.CostCodeId == forecast.CostCodeId && b.PhaseId == forecast.PhaseId, ct)
   forecast.VarianceToBudget = forecast.EstimatedFinalCost - (budget?.CurrentBudget ?? 0)
   Save
3. Return result
```

---

## 5. NarrativeService

**File:** `Services.cs`, class `NarrativeService` (line ~806)

### 5.1 `UpdateNarrativeAsync` -- Override with status guard

**Replace** the one-liner delegation:

```
1. Load entity: var narrative = await ProjectScoped<PmProjectNarrative>(projectId).FirstOrDefaultAsync(n => n.Id == narrativeId, ct)
2. If null: return NOT_FOUND
3. If narrative.Status == NarrativeStatus.Published:
   return Result.Failure<PmEntityDto>("Cannot edit a published narrative", "INVALID_STATUS")
4. Call ApplyUpsert, save, return ToDto
```

**Error codes:** `INVALID_STATUS`

### 5.2 `SubmitNarrativeAsync` -- Add status transition + required field check

**Modify** existing method (line ~817):

```
After loading narrative and null check:
1. If narrative.Status != NarrativeStatus.Draft:
   return Result.Failure<PmActionResultDto>(
       "Narrative can only be submitted from Draft status", "INVALID_STATUS")
2. If string.IsNullOrWhiteSpace(narrative.ExecutiveSummary):
   return Result.Failure<PmActionResultDto>(
       "ExecutiveSummary is required before submitting", "VALIDATION_ERROR")
3. Set status to Submitted, save (existing code)
```

**Error codes:** `INVALID_STATUS`, `VALIDATION_ERROR`

### 5.3 `PublishNarrativeAsync` -- Add status transition guard

**Modify** existing method (line ~828):

```
After loading narrative and null check:
1. If narrative.Status != NarrativeStatus.Approved:
   return Result.Failure<PmActionResultDto>(
       "Narrative can only be published from Approved status", "INVALID_STATUS")
2. Set status to Published, set FinalizedAt, save (existing code)
```

**Error codes:** `INVALID_STATUS`

**Note:** There is currently no `ApproveNarrativeAsync` in the interface, so the flow is Draft->Submitted (via SubmitNarrativeAsync), then Submitted->Approved must happen via `UpdateNarrativeAsync` setting Status to "Approved" (which the status guard allows since it only blocks Published), then Approved->Published (via PublishNarrativeAsync).

---

## 6. ProjectionService

**File:** `Services.cs`, class `ProjectionService` (line ~684)

### 6.1 `UpdateMonthlyProjectionAsync` -- Override with status guard + computed field

**Replace** the one-liner delegation:

```
1. Load entity: var projection = await ProjectScoped<PmMonthlyProjection>(projectId).FirstOrDefaultAsync(p => p.Id == projectionId, ct)
2. If null: return NOT_FOUND
3. If projection.ProjectionStatus == ProjectionStatus.Locked:
   return Result.Failure<PmEntityDto>("Cannot edit a locked projection", "INVALID_STATUS")
4. Call ApplyUpsert(entity, request)
5. Recompute: projection.AdjustedContractValue = projection.ContractValueOriginal + projection.ApprovedChangeOrders
6. Set entity.UpdatedAt, save, return ToDto
```

**Error codes:** `INVALID_STATUS`

### 6.2 `SubmitMonthlyProjectionAsync` -- Add status transition guard

**Modify** existing method (line ~695):

```
After loading projection and null check:
1. If projection.ProjectionStatus != ProjectionStatus.Draft:
   return Result.Failure<PmActionResultDto>(
       "Projection can only be submitted from Draft status", "INVALID_STATUS")
2. Recompute AdjustedContractValue before saving:
   projection.AdjustedContractValue = projection.ContractValueOriginal + projection.ApprovedChangeOrders
3. Set status to Submitted, save (existing code)
```

**Error codes:** `INVALID_STATUS`

### 6.3 `ApproveMonthlyProjectionAsync` -- Add status transition guard

**Modify** existing method (line ~706):

```
After loading projection and null check:
1. If projection.ProjectionStatus != ProjectionStatus.Submitted:
   return Result.Failure<PmActionResultDto>(
       "Projection can only be approved from Submitted status", "INVALID_STATUS")
2. Set status to Approved, save (existing code)
```

**Error codes:** `INVALID_STATUS`

---

## 7. ProgressService

**File:** `Services.cs`, class `ProgressService` (line ~634)

### 7.1 `UpdateProgressEntryAsync` -- Override with status guard

**Replace** the one-liner delegation:

```
1. Load entity: var entry = await ProjectScoped<PmProgressEntry>(projectId).FirstOrDefaultAsync(e => e.Id == progressEntryId, ct)
2. If null: return NOT_FOUND
3. If entry.Status == ProgressEntryStatus.Approved:
   return Result.Failure<PmEntityDto>("Cannot edit an approved progress entry", "INVALID_STATUS")
4. Call ApplyUpsert, save, return ToDto
```

**Error codes:** `INVALID_STATUS`

### 7.2 `ApproveProgressEntryAsync` -- Add status transition guard

**Modify** existing method (line ~645):

```
After loading progressEntry and null check:
1. If progressEntry.Status != ProgressEntryStatus.Submitted:
   return Result.Failure<PmActionResultDto>(
       "Progress entry can only be approved from Submitted status", "INVALID_STATUS")
2. Set status to Approved, save (existing code)
```

**Error codes:** `INVALID_STATUS`

### 7.3 `LinkTimeEntryAsync` -- Add duplicate prevention

**Modify** existing method (line ~656):

```
After progressEntry existence check:
1. Check duplicate: var duplicateLink = await Db.Set<PmProgressTimeEntryLink>()
       .AnyAsync(l => !l.IsDeleted && l.ProgressEntryId == progressEntryId
           && l.TimeEntryId == request.ReferenceId.Value, ct)
   If duplicate: return Result.Failure<PmActionResultDto>(
       "This time entry is already linked to this progress entry", "DUPLICATE_LINK")
2. Continue with existing link creation
```

**Error codes:** `DUPLICATE_LINK`

---

## 8. MeetingService

**File:** `Services.cs`, class `MeetingService` (line ~719)

### 8.1 `UpdateMeetingAsync` -- Override with status transition + auto-set timestamps

**Replace** the one-liner delegation:

```
1. Load entity: var meeting = await ProjectScoped<PmMeeting>(projectId).FirstOrDefaultAsync(m => m.Id == meetingId, ct)
2. If null: return NOT_FOUND
3. If meeting.Status == MeetingStatus.Completed || meeting.Status == MeetingStatus.Canceled:
   return Result.Failure<PmEntityDto>("Cannot edit a completed or canceled meeting", "INVALID_STATUS")
4. If request.Status is provided and is a status change:
   Valid transitions:
   - Scheduled -> InProgress
   - Scheduled -> Canceled
   - InProgress -> Completed
   - InProgress -> Canceled
   If invalid: return Result.Failure<PmEntityDto>("Invalid status transition from {from} to {to}", "INVALID_STATUS")
   If transitioning to InProgress: merge Data["ActualStart"] = DateTime.UtcNow
   If transitioning to Completed: merge Data["ActualEnd"] = DateTime.UtcNow
5. Call ApplyUpsert, save, return ToDto
```

**Error codes:** `INVALID_STATUS`

### 8.2 `AddAgendaItemAsync`, `AddMinutesAsync`, `AddActionItemAsync` -- Add meeting-status guard

For all three methods, **add a meeting status check before delegation**:

```
1. Load meeting: var meeting = await ProjectScoped<PmMeeting>(projectId).FirstOrDefaultAsync(m => m.Id == meetingId, ct)
2. If null: return Result.Failure<PmEntityDto>("Meeting not found", "NOT_FOUND")
3. If meeting.Status == MeetingStatus.Canceled:
   return Result.Failure<PmEntityDto>("Cannot add items to a canceled meeting", "INVALID_STATUS")
4. Call base CreateAsync<PmMeetingAgendaItem/PmMeetingMinute/PmMeetingActionItem>(...)
```

**Error codes:** `NOT_FOUND`, `INVALID_STATUS`

---

## Summary of New Error Codes

| Error Code | Services Using It |
|---|---|
| `INVALID_STATUS` | Submittal, DailyReport, Schedule, Narrative, Projection, Progress, Meeting |
| `VALIDATION_ERROR` | DailyReport (WorkNarrative), Narrative (ExecutiveSummary), Schedule (dependency), JobCost (CostCodeId) |
| `DUPLICATE_REPORT` | DailyReport |
| `DUPLICATE_BUDGET` | JobCost |
| `DUPLICATE_LINK` | Progress |

---

## Private Helper Method to Add

Add to `PmServiceBase` or as a `static` in each service:

```csharp
// Helper to merge a key into request.Data without mutating the original
protected static PmUpsertRequest MergeData(PmUpsertRequest request, string key, object value)
{
    var data = request.Data is null
        ? new Dictionary<string, object?>()
        : new Dictionary<string, object?>(request.Data);
    data[key] = value;
    return request with { Data = data };
}
```

This pattern already exists in `DocumentGenerationService.MergeData` (line ~773) but is private. Promote to `PmServiceBase` as a `protected static` method.

---

## Methods That Need NO Changes

These methods are pure CRUD pass-throughs or list queries that need no business logic:

- All `List*Async` methods (no validation needed beyond project scoping)
- All `Get*Async` methods (just read operations)
- `PlansSpecsService` -- all methods (document management is pure CRUD)
- `CommunicationService` -- all methods (communications are simple records)
- `TaskService` -- all methods (tasks use generic status, no enforced workflow)
- `DocumentGenerationService` -- all methods (template/doc generation is CRUD)
- `DailyReportService.AddPhotoAsync` -- pass-through is fine
- `DailyReportService.RollupDailyReportAsync` -- already has validation
- `ProgressService.CreateProgressEntryAsync` -- no status guard needed on create
- `ProgressService.ListEarnedValueSnapshotsAsync` / `ListSCurveAsync` -- read-only

---

## Execution Order for Implementer

1. Add `MergeData` helper to `PmServiceBase`
2. Implement `SubmittalService` changes (highest priority, most complex)
3. Implement `DailyReportService` changes
4. Implement `ScheduleService` changes
5. Implement `JobCostService` changes
6. Implement `NarrativeService` changes
7. Implement `ProjectionService` changes
8. Implement `ProgressService` changes
9. Implement `MeetingService` changes
10. Run existing tests to verify no regressions
