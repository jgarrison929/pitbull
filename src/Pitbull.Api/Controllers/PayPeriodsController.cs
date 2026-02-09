using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Attributes;
using Pitbull.Core.CQRS;
using Pitbull.Payroll.Domain;
using Pitbull.Payroll.Features;
using Pitbull.Payroll.Features.CreatePayPeriod;
using Pitbull.Payroll.Features.GetPayPeriod;
using Pitbull.Payroll.Features.ListPayPeriods;
using Pitbull.Payroll.Features.ClosePayPeriod;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Payroll Pay Periods - define payroll processing windows.
/// </summary>
[ApiController]
[Route("api/payroll/periods")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Payroll - Pay Periods")]
public class PayPeriodsController(IMediator mediator) : ControllerBase
{
    /// <summary>
    /// Create a new pay period.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(PayPeriodDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreatePayPeriodCommand command)
    {
        var result = await mediator.Send(command);
        if (!result.IsSuccess)
            return result.ErrorCode == "OVERLAP" ? Conflict(new { error = result.Error }) : BadRequest(new { error = result.Error });
        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    /// <summary>
    /// Get a pay period by ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [Cacheable(DurationSeconds = 60)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await mediator.Send(new GetPayPeriodQuery(id));
        if (!result.IsSuccess) return NotFound(new { error = result.Error });
        return Ok(result.Value);
    }

    /// <summary>
    /// List pay periods with optional filtering.
    /// </summary>
    [HttpGet]
    [Cacheable(DurationSeconds = 60)]
    public async Task<IActionResult> List(
        [FromQuery] PayPeriodStatus? status, [FromQuery] int? year,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        var query = new ListPayPeriodsQuery(status, year) { Page = page, PageSize = pageSize };
        return Ok((await mediator.Send(query)).Value);
    }

    /// <summary>
    /// Get the current open pay period.
    /// </summary>
    [HttpGet("current")]
    [Cacheable(DurationSeconds = 60)]
    public async Task<IActionResult> GetCurrent()
    {
        var query = new ListPayPeriodsQuery(Status: PayPeriodStatus.Open) { PageSize = 1 };
        var result = await mediator.Send(query);
        var current = result.Value?.Items.FirstOrDefault();
        if (current == null) return NotFound(new { error = "No open pay period found" });
        return Ok(current);
    }

    /// <summary>
    /// Close a pay period (requires all batches posted).
    /// </summary>
    [HttpPost("{id:guid}/close")]
    public async Task<IActionResult> Close(Guid id)
    {
        var closedBy = User.Identity?.Name ?? "system";
        var result = await mediator.Send(new ClosePayPeriodCommand(id, closedBy));
        if (!result.IsSuccess)
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { error = result.Error }),
                "ALREADY_CLOSED" => Conflict(new { error = result.Error }),
                "BATCHES_NOT_POSTED" => BadRequest(new { error = result.Error }),
                _ => BadRequest(new { error = result.Error })
            };
        return Ok(result.Value);
    }
}
