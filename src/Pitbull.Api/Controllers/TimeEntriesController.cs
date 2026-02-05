using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;
using Pitbull.TimeTracking.Features.CreateTimeEntry;
using Pitbull.TimeTracking.Features.GetTimeEntry;
using Pitbull.TimeTracking.Features.ListTimeEntries;

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
