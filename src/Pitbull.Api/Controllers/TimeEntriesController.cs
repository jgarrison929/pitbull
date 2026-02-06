using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;
using Pitbull.TimeTracking.Features.CreateTimeEntry;
using Pitbull.TimeTracking.Features.GetTimeEntry;
using Pitbull.TimeTracking.Features.GetTimeEntriesByProject;
using Pitbull.TimeTracking.Features.ListTimeEntries;
using Pitbull.TimeTracking.Features.UpdateTimeEntry;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Time entry management for tracking labor hours on projects.
/// Core feature for job costing - "labor hits job cost" workflow.
/// </summary>
[ApiController]
[Route("api/time-entries")]
[Authorize]
[EnableRateLimiting("api")]
public class TimeEntriesController(IMediator mediator) : ControllerBase
{
    /// <summary>
    /// Create a new time entry for an employee
    /// </summary>
    [HttpPost]
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
    [HttpGet("{id:guid}")]
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
    [HttpGet]
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
    [HttpPut("{id:guid}")]
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
    [HttpPost("{id:guid}/approve")]
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
    [HttpPost("{id:guid}/reject")]
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
    /// Get all time entries for a project (for project managers)
    /// </summary>
    [HttpGet("by-project/{projectId:guid}")]
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
