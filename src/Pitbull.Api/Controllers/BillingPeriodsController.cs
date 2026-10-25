using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Billing.Features.AiaBilling;
using Pitbull.Billing.Services;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/billing-periods")]
[Authorize(Policy = "Billing.View")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Billing Periods")]
public class BillingPeriodsController(IBillingPeriodService periodService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ListBillingPeriodsResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] BillingPeriodStatus? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        var result = await periodService.ListAsync(new ListBillingPeriodsQuery(status, page, pageSize));
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(BillingPeriodDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid id)
    {
        var result = await periodService.GetAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpPost]
    [ProducesResponseType(typeof(BillingPeriodDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateBillingPeriodRequest request)
    {
        CreateBillingPeriodCommand command = new(
            Name: request.Name,
            PeriodStart: request.PeriodStart,
            PeriodEnd: request.PeriodEnd,
            BillingDeadlineDay: request.BillingDeadlineDay,
            Notes: request.Notes);

        var result = await periodService.CreateAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(Get), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(BillingPeriodDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateBillingPeriodRequest request)
    {
        UpdateBillingPeriodCommand command = new(
            PeriodId: id,
            Name: request.Name,
            BillingDeadlineDay: request.BillingDeadlineDay,
            Status: request.Status,
            Notes: request.Notes);

        var result = await periodService.UpdateAsync(command);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { error = result.Error, code = result.ErrorCode }),
                _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
            };
        }

        return Ok(result.Value);
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await periodService.DeleteAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return NoContent();
    }
}

// ── Request Records ──

public record CreateBillingPeriodRequest(
    string Name,
    DateOnly PeriodStart,
    DateOnly PeriodEnd,
    int BillingDeadlineDay = 25,
    string? Notes = null
);

public record UpdateBillingPeriodRequest(
    string? Name = null,
    int? BillingDeadlineDay = null,
    BillingPeriodStatus? Status = null,
    string? Notes = null
);
