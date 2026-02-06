using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;
using Pitbull.TimeTracking.Features.CreateEmployee;
using Pitbull.TimeTracking.Features.GetEmployee;
using Pitbull.TimeTracking.Features.ListEmployees;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Employee management for time tracking and labor costing.
/// </summary>
[ApiController]
[Route("api/employees")]
[Authorize]
[EnableRateLimiting("api")]
public class EmployeesController(IMediator mediator) : ControllerBase
{
    /// <summary>
    /// Create a new employee
    /// </summary>
    [HttpPost]
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
    [HttpGet("{id:guid}")]
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
    [HttpGet]
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
}

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
