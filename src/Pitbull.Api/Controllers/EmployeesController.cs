using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;
using Pitbull.TimeTracking.Features.CreateEmployee;
using Pitbull.TimeTracking.Features.GetEmployee;
using Pitbull.TimeTracking.Features.GetEmployeeProjects;
using Pitbull.TimeTracking.Features.ListEmployees;
using Pitbull.TimeTracking.Features.UpdateEmployee;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Employee management for time tracking and labor costing.
/// Employees are assigned to projects and log time entries against cost codes.
/// </summary>
[ApiController]
[Route("api/employees")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Employees")]
public class EmployeesController(IMediator mediator) : ControllerBase
{
    /// <summary>
    /// Create a new employee
    /// </summary>
    /// <remarks>
    /// Creates an employee within the current tenant.
    /// Employee number must be unique within the tenant.
    /// Requires Admin or Manager role.
    ///
    /// Sample request:
    ///
    ///     POST /api/employees
    ///     {
    ///         "employeeNumber": "EMP-001",
    ///         "firstName": "John",
    ///         "lastName": "Smith",
    ///         "email": "john.smith@example.com",
    ///         "phone": "(555) 123-4567",
    ///         "title": "Carpenter",
    ///         "classification": 0,
    ///         "baseHourlyRate": 45.00,
    ///         "hireDate": "2026-01-15"
    ///     }
    ///
    /// Classification values: Hourly=0, Salary=1, Contractor=2
    /// </remarks>
    /// <param name="request">Employee details</param>
    /// <returns>The newly created employee</returns>
    /// <response code="201">Employee created successfully</response>
    /// <response code="400">Validation error</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="403">Not Admin or Manager role</response>
    /// <response code="409">Duplicate employee number</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpPost]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(typeof(EmployeeDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Create([FromBody] CreateEmployeeRequest request)
    {
        var command = new CreateEmployeeCommand(
            request.EmployeeNumber,
            request.FirstName,
            request.LastName,
            request.Email,
            request.Phone,
            request.Title,
            request.Classification,
            request.BaseHourlyRate,
            request.HireDate,
            request.SupervisorId,
            request.Notes
        );

        var result = await mediator.Send(command);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "DUPLICATE" => Conflict(new { error = result.Error }),
                _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
            };
        }

        return CreatedAtAction(nameof(GetById),
            new { id = result.Value!.Id }, result.Value);
    }

    /// <summary>
    /// Get a specific employee by ID
    /// </summary>
    /// <remarks>
    /// Returns full employee details including supervisor reference.
    /// Only returns employees within the authenticated user's tenant.
    /// </remarks>
    /// <param name="id">Employee unique identifier</param>
    /// <returns>Employee details</returns>
    /// <response code="200">Employee found</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Employee not found</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(EmployeeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await mediator.Send(new GetEmployeeQuery(id));
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    /// <summary>
    /// List employees with optional filtering
    /// </summary>
    /// <remarks>
    /// Returns paginated employee list with optional filters.
    /// Search matches against first name, last name, or employee number.
    /// </remarks>
    /// <param name="isActive">Filter by active status</param>
    /// <param name="classification">Filter by classification (Hourly=0, Salary=1, Contractor=2)</param>
    /// <param name="search">Search by name or employee number</param>
    /// <param name="page">Page number (default: 1)</param>
    /// <param name="pageSize">Items per page (default: 50, max: 100)</param>
    /// <returns>Paginated list of employees</returns>
    /// <response code="200">Employee list</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpGet]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)] // Paginated EmployeeDto list
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> List(
        [FromQuery] bool? isActive,
        [FromQuery] EmployeeClassification? classification,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var query = new ListEmployeesQuery(isActive, classification, search)
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
    /// Get project assignments for a specific employee
    /// </summary>
    /// <remarks>
    /// Returns the list of projects an employee is assigned to.
    /// Useful for populating project dropdowns in time entry forms.
    /// </remarks>
    /// <param name="id">Employee unique identifier</param>
    /// <param name="activeOnly">Only return active assignments (default: true)</param>
    /// <returns>List of project assignments</returns>
    /// <response code="200">Project assignments list</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Employee not found</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpGet("{id:guid}/projects")]
    [ProducesResponseType(typeof(IEnumerable<ProjectAssignmentDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetProjects(
        Guid id,
        [FromQuery] bool activeOnly = true)
    {
        var result = await mediator.Send(new GetEmployeeProjectsQuery(id, activeOnly));
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    /// <summary>
    /// Update an existing employee
    /// </summary>
    /// <remarks>
    /// Updates employee details. Requires Admin or Manager role.
    /// Setting isActive to false will deactivate the employee.
    /// Terminated employees cannot log new time entries.
    /// </remarks>
    /// <param name="id">Employee unique identifier</param>
    /// <param name="request">Updated employee details</param>
    /// <returns>Updated employee</returns>
    /// <response code="200">Employee updated</response>
    /// <response code="400">Validation error or invalid supervisor</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="403">Not Admin or Manager role</response>
    /// <response code="404">Employee not found</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(typeof(EmployeeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateEmployeeRequest request)
    {
        var command = new UpdateEmployeeCommand(
            id,
            request.FirstName,
            request.LastName,
            request.Email,
            request.Phone,
            request.Title,
            request.Classification,
            request.BaseHourlyRate,
            request.HireDate,
            request.TerminationDate,
            request.SupervisorId,
            request.IsActive,
            request.Notes
        );

        var result = await mediator.Send(command);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { error = result.Error }),
                "INVALID_SUPERVISOR" => BadRequest(new { error = result.Error, code = result.ErrorCode }),
                _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
            };
        }

        return Ok(result.Value);
    }
}

public record UpdateEmployeeRequest(
    string FirstName,
    string LastName,
    string? Email = null,
    string? Phone = null,
    string? Title = null,
    EmployeeClassification Classification = EmployeeClassification.Hourly,
    decimal BaseHourlyRate = 0,
    DateOnly? HireDate = null,
    DateOnly? TerminationDate = null,
    Guid? SupervisorId = null,
    bool IsActive = true,
    string? Notes = null
);

// Request DTOs
public record CreateEmployeeRequest(
    string EmployeeNumber,
    string FirstName,
    string LastName,
    string? Email = null,
    string? Phone = null,
    string? Title = null,
    EmployeeClassification Classification = EmployeeClassification.Hourly,
    decimal BaseHourlyRate = 0,
    DateOnly? HireDate = null,
    Guid? SupervisorId = null,
    string? Notes = null
);
