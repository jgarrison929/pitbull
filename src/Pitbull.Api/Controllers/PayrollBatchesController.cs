using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Attributes;
using Pitbull.Core.CQRS;
using Pitbull.Payroll.Domain;
using Pitbull.Payroll.Features;
using Pitbull.Payroll.Features.CreatePayrollBatch;
using Pitbull.Payroll.Features.GetPayrollBatch;
using Pitbull.Payroll.Features.ListPayrollBatches;
using Pitbull.Payroll.Features.ApprovePayrollBatch;
using Pitbull.Payroll.Features.PostPayrollBatch;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Payroll Batches - group payroll entries for processing.
/// </summary>
[ApiController]
[Route("api/payroll/batches")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Payroll - Batches")]
public class PayrollBatchesController(IMediator mediator) : ControllerBase
{
    /// <summary>
    /// Create a new payroll batch for a pay period.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(PayrollBatchDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreatePayrollBatchCommand command)
    {
        var result = await mediator.Send(command);
        if (!result.IsSuccess)
            return result.ErrorCode switch
            {
                "PERIOD_NOT_FOUND" => NotFound(new { error = result.Error }),
                "PERIOD_CLOSED" => Conflict(new { error = result.Error }),
                _ => BadRequest(new { error = result.Error })
            };
        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    /// <summary>
    /// Get a payroll batch by ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [Cacheable(DurationSeconds = 60)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await mediator.Send(new GetPayrollBatchQuery(id));
        if (!result.IsSuccess) return NotFound(new { error = result.Error });
        return Ok(result.Value);
    }

    /// <summary>
    /// List payroll batches with optional filtering.
    /// </summary>
    [HttpGet]
    [Cacheable(DurationSeconds = 60)]
    public async Task<IActionResult> List(
        [FromQuery] Guid? payPeriodId, [FromQuery] PayrollBatchStatus? status,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        var query = new ListPayrollBatchesQuery(payPeriodId, status) { Page = page, PageSize = pageSize };
        return Ok((await mediator.Send(query)).Value);
    }

    /// <summary>
    /// Approve a calculated batch for posting.
    /// </summary>
    [HttpPost("{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id)
    {
        var approvedBy = User.Identity?.Name ?? "system";
        var result = await mediator.Send(new ApprovePayrollBatchCommand(id, approvedBy));
        if (!result.IsSuccess)
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { error = result.Error }),
                "NOT_CALCULATED" => BadRequest(new { error = result.Error }),
                _ => BadRequest(new { error = result.Error })
            };
        return Ok(result.Value);
    }

    /// <summary>
    /// Post an approved batch to the general ledger.
    /// </summary>
    [HttpPost("{id:guid}/post")]
    public async Task<IActionResult> Post(Guid id)
    {
        var postedBy = User.Identity?.Name ?? "system";
        var result = await mediator.Send(new PostPayrollBatchCommand(id, postedBy));
        if (!result.IsSuccess)
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { error = result.Error }),
                "NOT_APPROVED" => BadRequest(new { error = result.Error }),
                _ => BadRequest(new { error = result.Error })
            };
        return Ok(result.Value);
    }
}
