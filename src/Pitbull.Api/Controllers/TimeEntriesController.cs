using DotNetCore.CAP;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;
using Pitbull.TimeTracking.Features.BatchCreateTimeEntries;
using Pitbull.TimeTracking.Features.BulkSubmitTimeEntries;
using Pitbull.TimeTracking.Features.CreateTimeEntry;
using Pitbull.TimeTracking.Features.ReviewTimeEntries;
using Pitbull.TimeTracking.Features.GetLaborCostReport;
using Pitbull.TimeTracking.Features.GetYesterdayCrewEntries;
using Pitbull.TimeTracking.Features.UpdateTimeEntry;
using Pitbull.TimeTracking.Messages;
using Pitbull.TimeTracking.Services;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Time entry management for tracking labor hours on projects.
/// Core feature for job costing - "labor hits job cost" workflow.
/// </summary>
[ApiController]
[Route("api/time-entries")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Time Entries")]
public class TimeEntriesController(ITimeEntryService timeEntryService, ICapPublisher capPublisher, ITenantContext tenantContext, ICompanyContext companyContext, PitbullDbContext db) : ControllerBase
{
    private Dictionary<string, string?> TenantHeaders()
    {
        var h = new Dictionary<string, string?>();
        if (tenantContext.IsResolved)
            h["X-Tenant-Id"] = tenantContext.TenantId.ToString();
        if (companyContext.IsResolved)
            h["X-Company-Id"] = companyContext.CompanyId.ToString();
        return h;
    }

    /// <summary>
    /// Create a new time entry for an employee
    /// </summary>
    /// <remarks>
    /// Creates a time entry linking an employee's hours to a project and cost code.
    /// The employee must have an active project assignment for the specified date.
    /// New entries default to Draft status.
    ///
    /// Sample request:
    ///
    ///     POST /api/time-entries
    ///     {
    ///         "date": "2026-02-06",
    ///         "employeeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    ///         "projectId": "3fa85f64-5717-4562-b3fc-2c963f66afa7",
    ///         "costCodeId": "3fa85f64-5717-4562-b3fc-2c963f66afa8",
    ///         "regularHours": 8.0,
    ///         "overtimeHours": 2.0,
    ///         "doubletimeHours": 0,
    ///         "description": "Foundation formwork"
    ///     }
    ///
    /// </remarks>
    /// <param name="request">Time entry details</param>
    /// <returns>The newly created time entry</returns>
    /// <response code="201">Time entry created successfully</response>
    /// <response code="400">Validation error (invalid hours, no project assignment, etc.)</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpPost]
    [ProducesResponseType(typeof(TimeEntryDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Create([FromBody] CreateTimeEntryRequest request)
    {
        var command = new CreateTimeEntryCommand(
            request.Date,
            request.EmployeeId,
            request.ProjectId,
            request.CostCodeId ?? Guid.Empty,
            request.RegularHours,
            request.OvertimeHours,
            request.DoubletimeHours,
            request.Description,
            request.PhaseId,
            request.EquipmentId,
            request.EquipmentHours
        );

        var result = await timeEntryService.CreateTimeEntryAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetById),
            new { id = result.Value!.Id }, result.Value);
    }

    /// <summary>
    /// Get a specific time entry by ID
    /// </summary>
    /// <remarks>
    /// Returns full time entry details including employee, project, cost code, and approval info.
    /// Only returns entries within the authenticated user's tenant.
    /// </remarks>
    /// <param name="id">Time entry unique identifier</param>
    /// <returns>Time entry details</returns>
    /// <response code="200">Time entry found</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Time entry not found</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(TimeEntryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await timeEntryService.GetTimeEntryAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    /// <summary>
    /// List time entries with optional filtering
    /// </summary>
    /// <remarks>
    /// Returns paginated time entries with optional filters by project, employee, date range, and status.
    /// Useful for building approval queues or generating reports.
    /// </remarks>
    /// <param name="projectId">Filter by project</param>
    /// <param name="employeeId">Filter by employee</param>
    /// <param name="foremanId">Filter by foreman's crew (Employee.SupervisorId)</param>
    /// <param name="startDate">Filter entries on or after this date</param>
    /// <param name="endDate">Filter entries on or before this date</param>
    /// <param name="status">Filter by status (Draft=0, Submitted=1, Approved=2, Rejected=3)</param>
    /// <param name="page">Page number (default: 1)</param>
    /// <param name="pageSize">Items per page (default: 25, max: 100)</param>
    /// <returns>Paginated list of time entries</returns>
    /// <response code="200">Time entries list</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpGet]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)] // Paginated TimeEntryDto list
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> List(
        [FromQuery] Guid? projectId,
        [FromQuery] Guid? employeeId,
        [FromQuery] DateOnly? startDate,
        [FromQuery] DateOnly? endDate,
        [FromQuery] TimeEntryStatus? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        [FromQuery] Guid? foremanId = null)
    {
        var result = await timeEntryService.ListTimeEntriesAsync(
            projectId, employeeId, startDate, endDate, status, page, pageSize, foremanId);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    /// <summary>
    /// Get a foreman's crew entries for a target date (used by Copy Yesterday in crew entry)
    /// </summary>
    /// <param name="foremanId">Foreman/supervisor employee ID</param>
    /// <param name="targetDate">Date to copy from (defaults to yesterday)</param>
    /// <returns>Crew entries grouped by employee</returns>
    [HttpGet("yesterday-crew")]
    [ProducesResponseType(typeof(YesterdayCrewEntriesResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetYesterdayCrewEntries(
        [FromQuery] Guid foremanId,
        [FromQuery] DateOnly? targetDate = null)
    {
        if (foremanId == Guid.Empty)
            return BadRequest(new { error = "Foreman ID is required", code = "VALIDATION_ERROR" });

        var result = await timeEntryService.GetYesterdayCrewEntriesAsync(foremanId, targetDate);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    /// <summary>
    /// Update a time entry (status changes, hour corrections, approval/rejection)
    /// </summary>
    /// <remarks>
    /// Updates hours, description, or status. Status changes follow workflow rules:
    /// - Draft → Submitted (by employee)
    /// - Submitted → Approved or Rejected (by supervisor/manager)
    /// - Rejected → Draft (re-submit after corrections)
    /// Approved entries cannot be modified.
    /// </remarks>
    /// <param name="id">Time entry unique identifier</param>
    /// <param name="request">Fields to update (all optional)</param>
    /// <returns>Updated time entry</returns>
    /// <response code="200">Time entry updated</response>
    /// <response code="400">Validation error or invalid status transition</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="403">Not authorized to modify this entry</response>
    /// <response code="404">Time entry not found</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(TimeEntryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTimeEntryRequest request)
    {
        // SEC-001: For approval/rejection via the generic update endpoint,
        // resolve approver from JWT — never trust the request body's ApproverId.
        Guid? approverId = request.ApproverId;
        if (request.NewStatus is TimeEntryStatus.Approved or TimeEntryStatus.Rejected)
        {
            var (userResult, employeeId) = await GetCurrentEmployeeIdAsync();
            if (!userResult.IsSuccess)
                return Unauthorized(new { error = userResult.Error });
            approverId = employeeId;
        }

        var command = new UpdateTimeEntryCommand(
            TimeEntryId: id,
            RegularHours: request.RegularHours,
            OvertimeHours: request.OvertimeHours,
            DoubletimeHours: request.DoubletimeHours,
            Description: request.Description,
            NewStatus: request.NewStatus,
            ApproverId: approverId,
            ApproverNotes: request.ApproverNotes,
            SubmittedById: request.SubmittedById,
            PhaseId: request.PhaseId,
            EquipmentId: request.EquipmentId,
            EquipmentHours: request.EquipmentHours
        );

        var result = await timeEntryService.UpdateTimeEntryAsync(command);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { error = result.Error }),
                "UNAUTHORIZED" => Forbid(),
                _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
            };
        }

        return Ok(result.Value);
    }

    /// <summary>
    /// Approve a time entry
    /// </summary>
    /// <remarks>
    /// Approves a submitted time entry. Only supervisors/managers can approve.
    /// Once approved, the entry is locked and included in cost reports and Vista exports.
    /// </remarks>
    /// <param name="id">Time entry unique identifier</param>
    /// <param name="request">Approver ID and optional comments</param>
    /// <returns>Updated time entry with Approved status</returns>
    /// <response code="200">Time entry approved</response>
    /// <response code="400">Entry not in Submitted status</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="403">Not authorized to approve</response>
    /// <response code="404">Time entry not found</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpPost("{id:guid}/approve")]
    [ProducesResponseType(typeof(TimeEntryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ApproveTimeEntryRequest request)
    {
        var (userResult, employeeId) = await GetCurrentEmployeeIdAsync();
        if (!userResult.IsSuccess)
            return Unauthorized(new { error = userResult.Error });

        var command = new UpdateTimeEntryCommand(
            TimeEntryId: id,
            NewStatus: TimeEntryStatus.Approved,
            ApproverId: employeeId,
            ApproverNotes: request.Comments
        );

        var result = await timeEntryService.UpdateTimeEntryAsync(command);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { error = result.Error }),
                "UNAUTHORIZED" => Forbid(),
                _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
            };
        }

        try
        {
            await capPublisher.PublishAsync("timeentries.approved", new TimeEntriesApproved
            {
                BatchId = Guid.NewGuid(),
                ApprovedById = employeeId,
                TimeEntryIds = [id],
                Count = 1,
                ApprovedAt = DateTime.UtcNow
            }, TenantHeaders());
        }
        catch (Exception ex)
        {
            HttpContext.RequestServices.GetService<ILogger<TimeEntriesController>>()?
                .LogWarning(ex, "Failed to publish CAP event for time entry approval");
        }

        return Ok(result.Value);
    }

    /// <summary>
    /// Reject a time entry
    /// </summary>
    /// <remarks>
    /// Rejects a submitted time entry with a reason. Employee can correct and resubmit.
    /// Rejected entries revert to Draft status.
    /// </remarks>
    /// <param name="id">Time entry unique identifier</param>
    /// <param name="request">Approver ID and rejection reason (required)</param>
    /// <returns>Updated time entry with Rejected status</returns>
    /// <response code="200">Time entry rejected</response>
    /// <response code="400">Entry not in Submitted status or missing reason</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="403">Not authorized to reject</response>
    /// <response code="404">Time entry not found</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpPost("{id:guid}/reject")]
    [ProducesResponseType(typeof(TimeEntryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Reject(Guid id, [FromBody] RejectTimeEntryRequest request)
    {
        var (userResult, employeeId) = await GetCurrentEmployeeIdAsync();
        if (!userResult.IsSuccess)
            return Unauthorized(new { error = userResult.Error });

        var command = new UpdateTimeEntryCommand(
            TimeEntryId: id,
            NewStatus: TimeEntryStatus.Rejected,
            ApproverId: employeeId,
            ApproverNotes: request.Reason
        );

        var result = await timeEntryService.UpdateTimeEntryAsync(command);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { error = result.Error }),
                "UNAUTHORIZED" => Forbid(),
                _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
            };
        }

        try
        {
            await capPublisher.PublishAsync("timeentries.rejected", new TimeEntriesRejected
            {
                BatchId = Guid.NewGuid(),
                RejectedById = employeeId,
                TimeEntryIds = [id],
                Count = 1,
                RejectedAt = DateTime.UtcNow
            }, TenantHeaders());
        }
        catch (Exception ex)
        {
            HttpContext.RequestServices.GetService<ILogger<TimeEntriesController>>()?
                .LogWarning(ex, "Failed to publish CAP event for time entry rejection");
        }

        return Ok(result.Value);
    }

    /// <summary>
    /// Get PM review queue grouped by project
    /// </summary>
    /// <param name="startDate">Optional queue start date (defaults to current week start)</param>
    /// <param name="endDate">Optional queue end date (defaults to current week end)</param>
    /// <param name="projectId">Optional project filter</param>
    /// <param name="supervisorId">Optional supervisor filter</param>
    /// <returns>Submitted time entries grouped by project</returns>
    [HttpGet("review-queue")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetReviewQueue(
        [FromQuery] DateOnly? startDate,
        [FromQuery] DateOnly? endDate,
        [FromQuery] Guid? projectId,
        [FromQuery] Guid? supervisorId)
    {
        var (userResult, employeeId) = await GetCurrentEmployeeIdAsync();
        if (!userResult.IsSuccess)
            return Unauthorized(new { error = userResult.Error });

        var result = await timeEntryService.GetReviewQueueAsync(
            startDate,
            endDate,
            projectId,
            supervisorId,
            employeeId);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    /// <summary>
    /// Bulk review submitted time entries
    /// </summary>
    /// <param name="request">Review decisions and approver</param>
    /// <returns>Per-entry review results</returns>
    [HttpPost("review")]
    [ProducesResponseType(typeof(ReviewTimeEntriesResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Review([FromBody] ReviewTimeEntriesRequest request)
    {
        var (userResult, employeeId) = await GetCurrentEmployeeIdAsync();
        if (!userResult.IsSuccess)
            return Unauthorized(new { error = userResult.Error });

        var parseFailures = new List<string>();
        var decisions = new List<TimeEntryReviewDecision>();

        foreach (var item in request.Decisions)
        {
            if (!TryParseDecisionType(item.Decision, out var decisionType))
            {
                parseFailures.Add($"Invalid decision '{item.Decision}' for time entry {item.TimeEntryId}");
                continue;
            }

            decisions.Add(new TimeEntryReviewDecision(
                item.TimeEntryId,
                decisionType,
                item.Comment));
        }

        if (parseFailures.Count > 0)
        {
            return BadRequest(new
            {
                error = string.Join("; ", parseFailures),
                code = "VALIDATION_ERROR"
            });
        }

        var result = await timeEntryService.ReviewTimeEntriesAsync(
            new ReviewTimeEntriesCommand(decisions),
            employeeId);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        var response = result.Value!;
        var decisionLookup = decisions.ToDictionary(d => d.TimeEntryId, d => d.Decision);
        var approvedIds = response.Results
            .Where(r => r.Success
                        && decisionLookup.TryGetValue(r.TimeEntryId, out var d)
                        && d == TimeEntryReviewDecisionType.Approve)
            .Select(r => r.TimeEntryId)
            .ToList();
        var rejectedIds = response.Results
            .Where(r => r.Success
                        && decisionLookup.TryGetValue(r.TimeEntryId, out var d)
                        && d == TimeEntryReviewDecisionType.Reject)
            .Select(r => r.TimeEntryId)
            .ToList();

        try
        {
            if (approvedIds.Count > 0)
            {
                await capPublisher.PublishAsync("timeentries.approved", new TimeEntriesApproved
                {
                    BatchId = Guid.NewGuid(),
                    ApprovedById = employeeId,
                    TimeEntryIds = approvedIds,
                    Count = approvedIds.Count,
                    ApprovedAt = DateTime.UtcNow
                }, TenantHeaders());
            }

            if (rejectedIds.Count > 0)
            {
                await capPublisher.PublishAsync("timeentries.rejected", new TimeEntriesRejected
                {
                    BatchId = Guid.NewGuid(),
                    RejectedById = employeeId,
                    TimeEntryIds = rejectedIds,
                    Count = rejectedIds.Count,
                    RejectedAt = DateTime.UtcNow
                }, TenantHeaders());
            }
        }
        catch (Exception ex)
        {
            HttpContext.RequestServices.GetService<ILogger<TimeEntriesController>>()?
                .LogWarning(ex, "Failed to publish CAP event for bulk review");
        }

        return Ok(response);
    }

    /// <summary>
    /// Get labor cost report with breakdown by project and cost code
    /// </summary>
    /// <remarks>
    /// Aggregates approved time entries into a cost report showing:
    /// - Total burdened labor cost
    /// - Breakdown by project (hours, base wage, burden, total cost)
    /// - Breakdown by cost code within each project
    /// 
    /// Uses the labor cost calculator with configurable burden rate (default 35%).
    /// Regular hours are at base rate, OT at 1.5x, DT at 2.0x.
    /// </remarks>
    /// <param name="projectId">Filter to a specific project</param>
    /// <param name="startDate">Filter entries from this date</param>
    /// <param name="endDate">Filter entries to this date</param>
    /// <param name="approvedOnly">Only include approved entries (default: true)</param>
    /// <returns>Cost report with project and cost code breakdowns</returns>
    /// <response code="200">Labor cost report</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Project not found (when projectId specified)</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpGet("cost-report")]
    [ProducesResponseType(typeof(LaborCostReportResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetCostReport(
        [FromQuery] Guid? projectId,
        [FromQuery] DateOnly? startDate,
        [FromQuery] DateOnly? endDate,
        [FromQuery] bool approvedOnly = true)
    {
        var result = await timeEntryService.GetLaborCostReportAsync(
            projectId, startDate, endDate, approvedOnly);

        if (!result.IsSuccess)
        {
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error });
        }

        return Ok(result.Value);
    }

    /// <summary>
    /// Get all time entries for a project (for project managers)
    /// </summary>
    /// <remarks>
    /// Returns paginated time entries for a specific project with optional summary statistics.
    /// Useful for project managers reviewing team time before approval.
    /// </remarks>
    /// <param name="projectId">Project unique identifier</param>
    /// <param name="startDate">Filter entries from this date</param>
    /// <param name="endDate">Filter entries to this date</param>
    /// <param name="status">Filter by status</param>
    /// <param name="includeSummary">Include hours/cost summary in response</param>
    /// <param name="page">Page number (default: 1)</param>
    /// <param name="pageSize">Items per page (default: 50)</param>
    /// <returns>Paginated time entries for the project</returns>
    /// <response code="200">Time entries for project</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Project not found</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpGet("by-project/{projectId:guid}")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)] // Paginated time entries with optional summary
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetByProject(
        Guid projectId,
        [FromQuery] DateOnly? startDate,
        [FromQuery] DateOnly? endDate,
        [FromQuery] TimeEntryStatus? status,
        [FromQuery] bool includeSummary = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var result = await timeEntryService.GetTimeEntriesByProjectAsync(
            projectId, startDate, endDate, status, includeSummary, page, pageSize);

        if (!result.IsSuccess)
        {
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error });
        }

        return Ok(result.Value);
    }

    /// <summary>
    /// Create multiple time entries in a single batch (draft or submitted)
    /// </summary>
    /// <remarks>
    /// Creates time entries for multiple employees at once. Used by foremen to enter
    /// time for their entire crew. Supports both draft saves and direct submissions.
    /// </remarks>
    /// <param name="request">Batch of time entries to create</param>
    /// <returns>Batch creation results with per-entry status</returns>
    /// <response code="201">Batch created successfully</response>
    /// <response code="400">Validation error</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpPost("batch")]
    [ProducesResponseType(typeof(BatchCreateTimeEntriesResult), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> BatchCreate([FromBody] BatchCreateRequest request)
    {
        var command = new BatchCreateTimeEntriesCommand(
            request.Entries.Select(e => new BatchTimeEntryItem(
                e.Date, e.EmployeeId, e.ProjectId, e.CostCodeId ?? Guid.Empty,
                e.RegularHours, e.OvertimeHours, e.DoubletimeHours,
                e.Description, e.PhaseId, e.EquipmentId, e.EquipmentHours, e.TimeEntryId
            )).ToList(),
            request.AllowPartialSuccess,
            request.IsDraft,
            request.SubmittedById
        );

        var result = await timeEntryService.BatchCreateTimeEntriesAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        var batchResult = result.Value!;

        // Publish event (fire-and-forget — never let event bus failures crash the request)
        try
        {
            if (request.IsDraft)
            {
                await capPublisher.PublishAsync("timeentries.draftsaved", new TimeEntriesDraftSaved
                {
                    BatchId = Guid.NewGuid(),
                    SavedById = request.SubmittedById ?? Guid.Empty,
                    Count = batchResult.SuccessCount,
                    SavedAt = DateTime.UtcNow
                }, TenantHeaders());
            }
            else
            {
                await capPublisher.PublishAsync("timeentries.submitted", new TimeEntriesSubmitted
                {
                    BatchId = Guid.NewGuid(),
                    SubmittedById = request.SubmittedById ?? Guid.Empty,
                    TimeEntryIds = batchResult.Results
                        .Where(r => r.Success && r.TimeEntryId.HasValue)
                        .Select(r => r.TimeEntryId!.Value).ToList(),
                    Count = batchResult.SuccessCount,
                    SubmittedAt = DateTime.UtcNow
                }, TenantHeaders());
            }
        }
        catch (Exception ex)
        {
            // Log but don't fail the request — time entries are already saved
            HttpContext.RequestServices.GetService<ILogger<TimeEntriesController>>()?
                .LogWarning(ex, "Failed to publish CAP event for batch time entry creation");
        }

        return StatusCode(StatusCodes.Status201Created, batchResult);
    }

    /// <summary>
    /// Submit draft time entries in bulk
    /// </summary>
    /// <remarks>
    /// Transitions multiple draft time entries to Submitted status.
    /// Validates that all entries are in Draft status and that employees/projects are still valid.
    /// </remarks>
    /// <param name="request">Time entry IDs to submit</param>
    /// <returns>Per-entry submission results</returns>
    /// <response code="200">Submission results</response>
    /// <response code="400">Validation error</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpPost("submit")]
    [ProducesResponseType(typeof(BulkSubmitTimeEntriesResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> BulkSubmit([FromBody] BulkSubmitRequest request)
    {
        if (request.TimeEntryIds.Count > 500)
            return BadRequest(new { error = "Maximum 500 entries per bulk submit", code = "VALIDATION_ERROR" });

        var command = new BulkSubmitTimeEntriesCommand(
            request.TimeEntryIds,
            request.SubmittedById
        );

        var result = await timeEntryService.BulkSubmitTimeEntriesAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        var submitResult = result.Value!;

        // Publish event for successful submissions
        try
        {
            if (submitResult.SuccessCount > 0)
            {
                await capPublisher.PublishAsync("timeentries.submitted", new TimeEntriesSubmitted
                {
                    BatchId = Guid.NewGuid(),
                    SubmittedById = request.SubmittedById,
                    TimeEntryIds = submitResult.Results
                        .Where(r => r.Success)
                        .Select(r => r.TimeEntryId).ToList(),
                    Count = submitResult.SuccessCount,
                    SubmittedAt = DateTime.UtcNow
                }, TenantHeaders());
            }
        }
        catch (Exception ex)
        {
            HttpContext.RequestServices.GetService<ILogger<TimeEntriesController>>()?
                .LogWarning(ex, "Failed to publish CAP event for bulk submit");
        }

        return Ok(submitResult);
    }

    /// <summary>
    /// Export approved time entries in Vista/Viewpoint compatible CSV format
    /// </summary>
    /// <remarks>
    /// Generates a CSV file compatible with Vista/Viewpoint payroll import.
    /// Only exports approved time entries for the specified date range.
    /// Requires Admin or Manager role.
    ///
    /// CSV columns: EmployeeNumber, EmployeeName, Date, ProjectNumber, ProjectName, 
    /// CostCodeCode, CostCodeName, RegularHours, OvertimeHours, DoubletimeHours,
    /// HourlyRate, RegularAmount, OvertimeAmount, DoubletimeAmount, TotalAmount
    ///
    /// To preview export metadata without downloading, set Accept: application/json header.
    /// </remarks>
    /// <param name="startDate">Start date for the export period (required)</param>
    /// <param name="endDate">End date for the export period (required)</param>
    /// <param name="projectId">Filter to a specific project</param>
    /// <returns>CSV file download or JSON metadata if accept header is application/json</returns>
    /// <response code="200">CSV file or metadata (based on Accept header)</response>
    /// <response code="400">Invalid date range (start > end, or range > 31 days)</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="403">Not Admin or Manager role</response>
    /// <response code="404">No approved entries found in date range</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpGet("export/vista")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> ExportVista(
        [FromQuery] DateOnly startDate,
        [FromQuery] DateOnly endDate,
        [FromQuery] Guid? projectId = null)
    {
        var result = await timeEntryService.ExportVistaTimesheetAsync(startDate, endDate, projectId);

        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { error = result.Error }),
                "INVALID_DATE_RANGE" => BadRequest(new { error = result.Error, code = result.ErrorCode }),
                "DATE_RANGE_TOO_LARGE" => BadRequest(new { error = result.Error, code = result.ErrorCode }),
                _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
            };
        }

        var export = result.Value!;

        // If client wants JSON metadata (for preview), return that
        if (Request.Headers.Accept.ToString().Contains("application/json"))
        {
            return Ok(new
            {
                fileName = export.FileName,
                rowCount = export.RowCount,
                totalHours = export.TotalHours,
                startDate = export.StartDate,
                endDate = export.EndDate,
                employeeCount = export.EmployeeCount,
                projectCount = export.ProjectCount
            });
        }

        // Return as downloadable CSV file
        var bytes = System.Text.Encoding.UTF8.GetBytes(export.CsvContent);
        return File(bytes, "text/csv", export.FileName);
    }

    private static bool TryParseDecisionType(string? decision, out TimeEntryReviewDecisionType decisionType)
    {
        decisionType = default;
        if (string.IsNullOrWhiteSpace(decision))
            return false;

        return decision.Trim().ToLowerInvariant() switch
        {
            "approve" => (decisionType = TimeEntryReviewDecisionType.Approve) == TimeEntryReviewDecisionType.Approve,
            "reject" => (decisionType = TimeEntryReviewDecisionType.Reject) == TimeEntryReviewDecisionType.Reject,
            _ => false
        };
    }

    private async Task<(Result, Guid)> GetCurrentEmployeeIdAsync()
    {
        var email = User.Identity?.Name
            ?? User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
            ?? User.FindFirst("email")?.Value;
        if (string.IsNullOrEmpty(email))
        {
            return (Result.Failure("User email not found in token.", "UNAUTHORIZED"), Guid.Empty);
        }

        var employee = await timeEntryService.GetEmployeeByEmailAsync(email);
        if (employee == null)
        {
            return (Result.Failure("No matching employee record found for the current user.", "UNAUTHORIZED"), Guid.Empty);
        }

        return (Result.Success(), employee.Id);
    }
}

// Request DTOs
public record CreateTimeEntryRequest(
    DateOnly Date,
    Guid EmployeeId,
    Guid ProjectId,
    Guid? CostCodeId = null,
    decimal RegularHours = 0,
    decimal OvertimeHours = 0,
    decimal DoubletimeHours = 0,
    string? Description = null,
    Guid? PhaseId = null,
    Guid? EquipmentId = null,
    decimal EquipmentHours = 0
);

public record UpdateTimeEntryRequest(
    decimal? RegularHours = null,
    decimal? OvertimeHours = null,
    decimal? DoubletimeHours = null,
    string? Description = null,
    TimeEntryStatus? NewStatus = null,
    Guid? ApproverId = null,
    string? ApproverNotes = null,
    Guid? SubmittedById = null,
    Guid? PhaseId = null,
    Guid? EquipmentId = null,
    decimal? EquipmentHours = null
);

public record ApproveTimeEntryRequest(
    string? Comments = null
);

public record RejectTimeEntryRequest(
    string Reason
);

public record BatchCreateRequest(
    List<BatchCreateItemRequest> Entries,
    bool AllowPartialSuccess = false,
    bool IsDraft = false,
    Guid? SubmittedById = null
);

// ── Audit Trail ─────────────────────────────────────────────────────

/// <summary>
/// Approval audit trail for time entries — who submitted, approved, or rejected what and when.
/// </summary>
[ApiController]
[Route("api/time-entries/audit-trail")]
[Authorize(Roles = "Admin,Manager,Supervisor")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Time Entries")]
public class TimeEntryAuditController(PitbullDbContext auditDb) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(TimeEntryAuditListResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] string? action,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        var query = auditDb.Set<AuditLog>()
            .AsNoTracking()
            .Where(a => a.ResourceType == "TimeEntry");

        // Filter to approval-related actions
        var approvalActions = new[] { AuditAction.Create, AuditAction.Update, AuditAction.Approval, AuditAction.Rejection, AuditAction.StatusChange };
        query = query.Where(a => approvalActions.Contains(a.Action));

        if (from.HasValue)
            query = query.Where(a => a.Timestamp >= from.Value.Date);
        if (to.HasValue)
            query = query.Where(a => a.Timestamp < to.Value.Date.AddDays(1));
        if (!string.IsNullOrEmpty(action) && Enum.TryParse<AuditAction>(action, true, out var parsedAction))
            query = query.Where(a => a.Action == parsedAction);
        if (!string.IsNullOrEmpty(search))
            query = query.Where(a =>
                (a.UserName != null && a.UserName.Contains(search)) ||
                (a.Description != null && a.Description.Contains(search)));

        var totalCount = await query.CountAsync();
        pageSize = Math.Clamp(pageSize, 1, 100);
        var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        var items = await query
            .OrderByDescending(a => a.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new TimeEntryAuditDto
            {
                Id = a.Id,
                Action = a.Action.ToString(),
                UserName = a.UserName,
                UserEmail = a.UserEmail,
                Description = a.Description,
                Changes = a.Changes,
                Timestamp = a.Timestamp,
            })
            .ToListAsync();

        return Ok(new TimeEntryAuditListResponse
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = totalPages,
        });
    }
}

public record TimeEntryAuditDto
{
    public Guid Id { get; init; }
    public string Action { get; init; } = string.Empty;
    public string? UserName { get; init; }
    public string? UserEmail { get; init; }
    public string Description { get; init; } = string.Empty;
    public string? Changes { get; init; }
    public DateTime Timestamp { get; init; }
}

public record TimeEntryAuditListResponse
{
    public List<TimeEntryAuditDto> Items { get; init; } = [];
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalPages { get; init; }
}

public record BatchCreateItemRequest(
    DateOnly Date,
    Guid EmployeeId,
    Guid ProjectId,
    Guid? CostCodeId = null,
    decimal RegularHours = 0,
    decimal OvertimeHours = 0,
    decimal DoubletimeHours = 0,
    string? Description = null,
    Guid? PhaseId = null,
    Guid? EquipmentId = null,
    decimal EquipmentHours = 0,
    Guid? TimeEntryId = null
);

public record BulkSubmitRequest(
    List<Guid> TimeEntryIds,
    Guid SubmittedById
);

public record ReviewTimeEntriesRequest(
    List<ReviewTimeEntryDecisionRequest> Decisions
);

public record ReviewTimeEntryDecisionRequest(
    Guid TimeEntryId,
    string Decision,
    string? Comment = null
);
