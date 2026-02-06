using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;
using Pitbull.TimeTracking.Features.CreateTimeEntry;
using Pitbull.TimeTracking.Features.ExportVistaTimesheet;
using Pitbull.TimeTracking.Features.GetTimeEntry;
using Pitbull.TimeTracking.Features.GetTimeEntriesByProject;
using Pitbull.TimeTracking.Features.ListTimeEntries;
using Pitbull.TimeTracking.Features.UpdateTimeEntry;
using Pitbull.TimeTracking.Features.GetLaborCostReport;
using static Pitbull.TimeTracking.Features.GetLaborCostReport.GetLaborCostReportQuery;

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
public class TimeEntriesController(IMediator mediator) : ControllerBase
{
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
            request.CostCodeId,
            request.RegularHours,
            request.OvertimeHours,
            request.DoubletimeHours,
            request.Description
        );

        var result = await mediator.Send(command);
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
        var result = await mediator.Send(new GetTimeEntryQuery(id));
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
        [FromQuery] int pageSize = 25)
    {
        var query = new ListTimeEntriesQuery(projectId, employeeId, startDate, endDate, status)
        {
            Page = page,
            PageSize = pageSize
        };

        var result = await mediator.Send(query);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error });

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
        var command = new UpdateTimeEntryCommand(
            TimeEntryId: id,
            RegularHours: request.RegularHours,
            OvertimeHours: request.OvertimeHours,
            DoubletimeHours: request.DoubletimeHours,
            Description: request.Description,
            NewStatus: request.NewStatus,
            ApproverId: request.ApproverId,
            ApproverNotes: request.ApproverNotes
        );

        var result = await mediator.Send(command);
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
        var command = new UpdateTimeEntryCommand(
            TimeEntryId: id,
            NewStatus: TimeEntryStatus.Approved,
            ApproverId: request.ApproverId,
            ApproverNotes: request.Comments
        );

        var result = await mediator.Send(command);
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
        var command = new UpdateTimeEntryCommand(
            TimeEntryId: id,
            NewStatus: TimeEntryStatus.Rejected,
            ApproverId: request.ApproverId,
            ApproverNotes: request.Reason
        );

        var result = await mediator.Send(command);
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
        var query = new GetLaborCostReportQuery(projectId, startDate, endDate, approvedOnly);
        var result = await mediator.Send(query);

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
        var query = new GetTimeEntriesByProjectQuery(
            projectId, startDate, endDate, status, includeSummary)
        {
            Page = page,
            PageSize = pageSize
        };

        var result = await mediator.Send(query);
        if (!result.IsSuccess)
        {
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error });
        }

        return Ok(result.Value);
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
        var query = new ExportVistaTimesheetQuery(startDate, endDate, projectId);
        var result = await mediator.Send(query);

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
}

// Request DTOs
public record CreateTimeEntryRequest(
    DateOnly Date,
    Guid EmployeeId,
    Guid ProjectId,
    Guid CostCodeId,
    decimal RegularHours,
    decimal OvertimeHours = 0,
    decimal DoubletimeHours = 0,
    string? Description = null
);

public record UpdateTimeEntryRequest(
    decimal? RegularHours = null,
    decimal? OvertimeHours = null,
    decimal? DoubletimeHours = null,
    string? Description = null,
    TimeEntryStatus? NewStatus = null,
    Guid? ApproverId = null,
    string? ApproverNotes = null
);

public record ApproveTimeEntryRequest(
    Guid ApproverId,
    string? Comments = null
);

public record RejectTimeEntryRequest(
    Guid ApproverId,
    string Reason
);
