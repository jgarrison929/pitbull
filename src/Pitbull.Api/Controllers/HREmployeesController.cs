using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Attributes;
using Pitbull.Core.CQRS;
using Pitbull.HR.Domain;
using Pitbull.HR.Features;
using Pitbull.HR.Features.CreateEmployee;
using Pitbull.HR.Features.GetEmployee;
using Pitbull.HR.Features.ListEmployees;
using Pitbull.HR.Features.UpdateEmployee;

namespace Pitbull.Api.Controllers;

/// <summary>
/// HR Employee management - the source of truth for employee data.
/// This is the new HR Core module endpoint. During migration, the legacy
/// /api/employees endpoint remains available for TimeTracking.
/// </summary>
[ApiController]
[Route("api/hr/employees")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("HR - Employees")]
public class HREmployeesController(IMediator mediator) : ControllerBase
{
    /// <summary>
    /// Create a new employee in HR Core
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(EmployeeDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Create([FromBody] CreateEmployeeCommand command)
    {
        var result = await mediator.Send(command);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "DUPLICATE_EMPLOYEE_NUMBER" => Conflict(new { error = result.Error, code = result.ErrorCode }),
                _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
            };
        }

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    /// <summary>
    /// Get an HR employee by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    [Cacheable(DurationSeconds = 120)]
    [ProducesResponseType(typeof(EmployeeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await mediator.Send(new GetEmployeeQuery(id));
        if (!result.IsSuccess)
        {
            return result.ErrorCode == "NOT_FOUND" 
                ? NotFound(new { error = result.Error }) 
                : BadRequest(new { error = result.Error });
        }

        return Ok(result.Value);
    }

    /// <summary>
    /// List HR employees with filtering and pagination
    /// </summary>
    [HttpGet]
    [Cacheable(DurationSeconds = 60)]
    [ProducesResponseType(typeof(PagedResult<EmployeeListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] EmploymentStatus? status,
        [FromQuery] WorkerType? workerType,
        [FromQuery] string? tradeCode,
        [FromQuery] string? search,
        [FromQuery] bool includeTerminated = false,
        [FromQuery] ListEmployeesSortBy sortBy = ListEmployeesSortBy.LastName,
        [FromQuery] bool sortDescending = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        var query = new ListEmployeesQuery(
            Status: status,
            WorkerType: workerType,
            TradeCode: tradeCode,
            Search: search,
            IncludeTerminated: includeTerminated,
            SortBy: sortBy,
            SortDescending: sortDescending)
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
    /// Update an HR employee
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(EmployeeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateEmployeeCommand command)
    {
        if (id != command.Id)
            return BadRequest(new { error = "Route ID does not match body ID" });

        var result = await mediator.Send(command);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { error = result.Error }),
                _ => BadRequest(new { error = result.Error })
            };
        }

        return Ok(result.Value);
    }
}
