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
/// <remarks>
/// Project assignments control which employees can log time to which projects.
/// Each assignment includes a role (Worker, Foreman, Superintendent, ProjectManager)
/// and optional date range for seasonal or contract workers.
/// </remarks>
[ApiController]
[Route("api/project-assignments")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Project Assignments")]
public class ProjectAssignmentsController(IMediator mediator) : ControllerBase
{
    /// <summary>
    /// Assign an employee to a project
    /// </summary>
    /// <remarks>
    /// Creates a new assignment linking an employee to a project. The employee
    /// will then be able to log time entries against this project.
    /// 
    /// Assignment roles determine permissions:
    /// - **Worker** (0): Can log own time only
    /// - **Foreman** (1): Can log time for crew members
    /// - **Superintendent** (2): Can approve time entries
    /// - **ProjectManager** (3): Full project time management
    /// 
    /// Optional date ranges can restrict when the assignment is active,
    /// useful for seasonal workers or fixed-term contracts.
    /// </remarks>
    /// <param name="request">Assignment details including employee, project, and role</param>
    /// <returns>The created assignment</returns>
    /// <response code="201">Assignment created successfully</response>
    /// <response code="400">Invalid request data</response>
    /// <response code="404">Employee or project not found</response>
    /// <response code="409">Employee already assigned to this project</response>
    [HttpPost]
    [ProducesResponseType(typeof(ProjectAssignmentDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
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
    /// <remarks>
    /// Returns a list of all employees currently assigned to the specified project.
    /// Use `activeOnly=true` (default) to filter to currently active assignments,
    /// or `activeOnly=false` to include historical assignments.
    /// 
    /// Results include employee details, role, assignment dates, and notes.
    /// </remarks>
    /// <param name="projectId">The project ID to query</param>
    /// <param name="activeOnly">If true, only return currently active assignments (default: true)</param>
    /// <returns>List of project assignments with employee details</returns>
    /// <response code="200">List of assignments returned successfully</response>
    /// <response code="400">Invalid request</response>
    [HttpGet("by-project/{projectId:guid}")]
    [ProducesResponseType(typeof(IEnumerable<ProjectAssignmentDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
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
    /// <remarks>
    /// Returns a list of all projects the specified employee is assigned to.
    /// 
    /// Filtering options:
    /// - **activeOnly**: Filter to active assignments only (default: true)
    /// - **asOfDate**: Check assignment status as of a specific date
    /// 
    /// Useful for:
    /// - Populating project dropdowns in time entry forms
    /// - Viewing an employee's project history
    /// - Checking historical assignments for payroll
    /// </remarks>
    /// <param name="employeeId">The employee ID to query</param>
    /// <param name="activeOnly">If true, only return currently active assignments (default: true)</param>
    /// <param name="asOfDate">Optional date to check assignment status (for historical queries)</param>
    /// <returns>List of project assignments for the employee</returns>
    /// <response code="200">List of assignments returned successfully</response>
    /// <response code="400">Invalid request</response>
    [HttpGet("by-employee/{employeeId:guid}")]
    [ProducesResponseType(typeof(IEnumerable<ProjectAssignmentDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
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
    /// Remove an employee from a project by assignment ID
    /// </summary>
    /// <remarks>
    /// Deactivates the specified assignment. This is a soft delete - the assignment
    /// record is preserved for historical reporting but marked as inactive.
    /// 
    /// If an end date is provided, the assignment remains active until that date.
    /// If no end date is provided, the assignment ends immediately (today).
    /// 
    /// **Note**: This does not delete existing time entries. Use this when an
    /// employee leaves a project but their historical time should be preserved.
    /// </remarks>
    /// <param name="assignmentId">The assignment ID to remove</param>
    /// <param name="endDate">Optional end date for the assignment (defaults to today)</param>
    /// <response code="204">Assignment removed successfully</response>
    /// <response code="400">Invalid request</response>
    /// <response code="404">Assignment not found</response>
    [HttpDelete("{assignmentId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
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
    /// <remarks>
    /// Alternative removal method when you have the employee and project IDs
    /// but not the specific assignment ID. Finds and deactivates the active
    /// assignment between the specified employee and project.
    /// 
    /// Behavior is identical to the assignment ID-based removal:
    /// - Soft delete preserving historical data
    /// - Optional end date for future-dated removal
    /// - Existing time entries are preserved
    /// </remarks>
    /// <param name="employeeId">The employee ID</param>
    /// <param name="projectId">The project ID</param>
    /// <param name="endDate">Optional end date for the assignment (defaults to today)</param>
    /// <response code="204">Assignment removed successfully</response>
    /// <response code="400">Invalid request or missing parameters</response>
    /// <response code="404">No active assignment found for this employee-project pair</response>
    [HttpDelete]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
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

/// <summary>
/// Request to assign an employee to a project
/// </summary>
/// <param name="EmployeeId">The employee to assign</param>
/// <param name="ProjectId">The project to assign them to</param>
/// <param name="Role">The employee's role on this project (Worker, Foreman, Superintendent, ProjectManager)</param>
/// <param name="StartDate">Optional start date for the assignment (defaults to today)</param>
/// <param name="EndDate">Optional end date for fixed-term assignments</param>
/// <param name="Notes">Optional notes about this assignment</param>
public record AssignEmployeeRequest(
    Guid EmployeeId,
    Guid ProjectId,
    AssignmentRole Role = AssignmentRole.Worker,
    DateOnly? StartDate = null,
    DateOnly? EndDate = null,
    string? Notes = null
);
