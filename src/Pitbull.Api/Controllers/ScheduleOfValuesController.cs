using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Extensions;
using Pitbull.Contracts.Features.SOV;
using Pitbull.Contracts.Services;

namespace Pitbull.Api.Controllers;

[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Schedule of Values")]
public class ScheduleOfValuesController(ISOVService sovService) : ControllerBase
{
    /// <summary>
    /// Get SOV for a subcontract
    /// </summary>
    [HttpGet("api/contracts/{contractId:guid}/sov")]
    public async Task<IActionResult> GetByContract(Guid contractId)
    {
        var result = await sovService.GetBySubcontractAsync(contractId);
        return this.HandleResult(result);
    }

    /// <summary>
    /// Create SOV for a subcontract
    /// </summary>
    [HttpPost("api/contracts/{contractId:guid}/sov")]
    public async Task<IActionResult> Create(Guid contractId, [FromBody] CreateSOVCommand command)
    {
        var result = await sovService.CreateAsync(contractId, command);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => this.NotFoundError(result.Error ?? "Contract not found"),
                "DUPLICATE" => Conflict(new { error = result.Error }),
                _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
            };
        }

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    /// <summary>
    /// Get SOV by ID with all line items
    /// </summary>
    [HttpGet("api/sov/{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await sovService.GetByIdAsync(id);
        return this.HandleResult(result);
    }

    /// <summary>
    /// Get SOV summary (totals, percent complete, retainage)
    /// </summary>
    [HttpGet("api/sov/{id:guid}/summary")]
    public async Task<IActionResult> GetSummary(Guid id)
    {
        var result = await sovService.GetSummaryAsync(id);
        return this.HandleResult(result);
    }

    /// <summary>
    /// Add a line item to the SOV
    /// </summary>
    [HttpPost("api/sov/{id:guid}/line-items")]
    public async Task<IActionResult> AddLineItem(Guid id, [FromBody] CreateSOVLineItemCommand command)
    {
        var result = await sovService.AddLineItemAsync(id, command);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => this.NotFoundError(result.Error ?? "SOV not found"),
                "DUPLICATE" => Conflict(new { error = result.Error }),
                _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
            };
        }

        return Created($"/api/sov/{id}/line-items/{result.Value!.Id}", result.Value);
    }

    /// <summary>
    /// Update a line item
    /// </summary>
    [HttpPut("api/sov/{id:guid}/line-items/{lineItemId:guid}")]
    public async Task<IActionResult> UpdateLineItem(Guid id, Guid lineItemId, [FromBody] UpdateSOVLineItemCommand command)
    {
        var result = await sovService.UpdateLineItemAsync(id, lineItemId, command);
        return this.HandleResult(result);
    }

    /// <summary>
    /// Delete a line item (soft delete)
    /// </summary>
    [HttpDelete("api/sov/{id:guid}/line-items/{lineItemId:guid}")]
    public async Task<IActionResult> DeleteLineItem(Guid id, Guid lineItemId)
    {
        var result = await sovService.DeleteLineItemAsync(id, lineItemId);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? this.NotFoundError(result.Error ?? "Not found")
                : BadRequest(new { error = result.Error });

        return NoContent();
    }

    /// <summary>
    /// Reorder line items
    /// </summary>
    [HttpPost("api/sov/{id:guid}/line-items/reorder")]
    public async Task<IActionResult> ReorderLineItems(Guid id, [FromBody] ReorderSOVLineItemsCommand command)
    {
        var result = await sovService.ReorderLineItemsAsync(id, command);
        return this.HandleResult(result);
    }
}
