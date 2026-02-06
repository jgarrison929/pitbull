using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;
using Pitbull.TimeTracking.Features.AssignEmployeeToProject;
using Pitbull.TimeTracking.Features.GetEmployeeProjects;
using Pitbull.TimeTracking.Features.GetProjectAssignments;
using Pitbull.TimeTracking.Features.RemoveEmployeeFromProject;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Manage employee-project assignments for time tracking.
/// Employees must be assigned to a project before logging time.
/// </summary>
[ApiController]
[Route("api/project-assignments")]
[Authorize]
[EnableRateLimiting("api")]
public class ProjectAssignmentsController(IMediator mediator) : ControllerBase
{
    /// <summary>
    /// Assign an employee to a project
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Assign([FromBody] AssignEmployeeRequest request)
    {
        var command = new AssignEmployeeToProjectCommand(
            request.EmployeeId,
            request.ProjectId,
            request.Role,
            request.StartDate,
            request.EndDate,
            request.Notes
        );

        var result = await mediator.Send(command);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "EMPLOYEE_NOT_FOUND" or "PROJECT_NOT_FOUND" => NotFound(new { error = result.Error }),
                "ALREADY_ASSIGNED" => Conflict(new { error = result.Error }),
                _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
            };
        }

        return CreatedAtAction(nameof(GetByProject),
            new { projectId = request.ProjectId }, result.Value);
    }

    /// <summary>
    /// Get all employees assigned to a project
    /// </summary>
    [HttpGet("by-project/{projectId:guid}")]
    public async Task<IActionResult> GetByProject(
        Guid projectId,
        [FromQuery] bool activeOnly = true)
    {
        var query = new GetProjectAssignmentsQuery(projectId, activeOnly);
        var result = await mediator.Send(query);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    /// <summary>
    /// Get all projects an employee is assigned to
    /// </summary>
    [HttpGet("by-employee/{employeeId:guid}")]
    public async Task<IActionResult> GetByEmployee(
        Guid employeeId,
        [FromQuery] bool activeOnly = true,
        [FromQuery] DateOnly? asOfDate = null)
    {
        var query = new GetEmployeeProjectsQuery(employeeId, activeOnly, asOfDate);
        var result = await mediator.Send(query);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    /// <summary>
    /// Remove an employee from a project (deactivates the assignment)
    /// </summary>
    [HttpDelete("{assignmentId:guid}")]
    public async Task<IActionResult> Remove(
        Guid assignmentId,
        [FromQuery] DateOnly? endDate = null)
    {
        var command = new RemoveEmployeeFromProjectCommand(assignmentId, endDate);
        var result = await mediator.Send(command);

        if (!result.IsSuccess)
        {
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });
        }

        return NoContent();
    }

    /// <summary>
    /// Remove an employee from a project by employee and project IDs
    /// </summary>
    [HttpDelete]
    public async Task<IActionResult> RemoveByIds(
        [FromQuery] Guid employeeId,
        [FromQuery] Guid projectId,
        [FromQuery] DateOnly? endDate = null)
    {
        var command = new RemoveEmployeeFromProjectByIdsCommand(employeeId, projectId, endDate);
        var result = await mediator.Send(command);

        if (!result.IsSuccess)
        {
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });
        }

        return NoContent();
    }
}

// Request DTOs
public record AssignEmployeeRequest(
    Guid EmployeeId,
    Guid ProjectId,
    AssignmentRole Role = AssignmentRole.Worker,
    DateOnly? StartDate = null,
    DateOnly? EndDate = null,
    string? Notes = null
);
