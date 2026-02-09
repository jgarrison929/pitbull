using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Attributes;
using Pitbull.Core.CQRS;
using Pitbull.HR.Domain;
using Pitbull.HR.Features;
using Pitbull.HR.Features.CreatePayRate;
using Pitbull.HR.Features.DeletePayRate;
using Pitbull.HR.Features.GetPayRate;
using Pitbull.HR.Features.ListPayRates;
using Pitbull.HR.Features.UpdatePayRate;

namespace Pitbull.Api.Controllers;

/// <summary>
/// HR Pay Rate management - track employee pay rates with effective dating.
/// Supports construction-specific patterns: prevailing wage, shift differentials,
/// project-specific rates, and union scale with fringe benefits.
/// </summary>
[ApiController]
[Route("api/hr/pay-rates")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("HR - Pay Rates")]
public class HRPayRatesController(IMediator mediator) : ControllerBase
{
    /// <summary>
    /// Create a new pay rate for an employee
    /// </summary>
    /// <remarks>
    /// Pay rates support:
    /// - Effective dating (EffectiveDate, ExpirationDate)
    /// - Project-specific rates (ProjectId)
    /// - Shift differentials (ShiftCode)
    /// - State-specific rates (WorkState)
    /// - Union fringe benefits (FringeRate, HealthWelfareRate, PensionRate, etc.)
    /// - Priority-based rate selection (higher priority = checked first)
    /// </remarks>
    [HttpPost]
    [ProducesResponseType(typeof(PayRateDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create([FromBody] CreatePayRateCommand command)
    {
        var result = await mediator.Send(command);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "EMPLOYEE_NOT_FOUND" => NotFound(new { error = result.Error, code = result.ErrorCode }),
                _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
            };
        }

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    /// <summary>
    /// Get a pay rate by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    [Cacheable(DurationSeconds = 120)]
    [ProducesResponseType(typeof(PayRateDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await mediator.Send(new GetPayRateQuery(id));
        if (!result.IsSuccess)
        {
            return result.ErrorCode == "NOT_FOUND" 
                ? NotFound(new { error = result.Error }) 
                : BadRequest(new { error = result.Error });
        }

        return Ok(result.Value);
    }

    /// <summary>
    /// List pay rates with filtering and pagination
    /// </summary>
    /// <remarks>
    /// Filter options:
    /// - employeeId: Filter by specific employee
    /// - rateType: Filter by rate type (Hourly, Daily, Piece, Salary)
    /// - projectId: Filter by project
    /// - shiftCode: Filter by shift (e.g., "DAY", "SWING", "GRAVE")
    /// - workState: Filter by work state (2-letter code)
    /// - activeOnly: Only show currently active rates
    /// - asOfDate: Check active status as of this date (defaults to today)
    /// </remarks>
    [HttpGet]
    [Cacheable(DurationSeconds = 60)]
    [ProducesResponseType(typeof(PagedResult<PayRateListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] Guid? employeeId,
        [FromQuery] RateType? rateType,
        [FromQuery] Guid? projectId,
        [FromQuery] string? shiftCode,
        [FromQuery] string? workState,
        [FromQuery] bool? activeOnly,
        [FromQuery] DateOnly? asOfDate,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        var query = new ListPayRatesQuery(
            EmployeeId: employeeId,
            RateType: rateType,
            ProjectId: projectId,
            ShiftCode: shiftCode,
            WorkState: workState,
            ActiveOnly: activeOnly,
            AsOfDate: asOfDate)
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
    /// Get active pay rates for an employee
    /// </summary>
    /// <remarks>
    /// Convenience endpoint that returns all currently active pay rates
    /// for a specific employee, ordered by priority (highest first).
    /// </remarks>
    [HttpGet("employee/{employeeId:guid}/active")]
    [Cacheable(DurationSeconds = 120)]
    [ProducesResponseType(typeof(PagedResult<PayRateListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListActiveByEmployee(Guid employeeId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var query = new ListPayRatesQuery(
            EmployeeId: employeeId,
            ActiveOnly: true)
        {
            Page = page,
            PageSize = pageSize
        };
        
        var result = await mediator.Send(query);
        return Ok(result.Value);
    }

    /// <summary>
    /// Update a pay rate
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(PayRateDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePayRateCommand command)
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

    /// <summary>
    /// Delete (soft-delete) a pay rate
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await mediator.Send(new DeletePayRateCommand(id));
        return result ? NoContent() : NotFound();
    }
}
