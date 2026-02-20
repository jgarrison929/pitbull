using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Billing.Features.AiaBilling;
using Pitbull.Billing.Services;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/billing-applications")]
[Authorize(Roles = "Admin")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Billing Applications")]
public class BillingApplicationsController(IBillingApplicationService billingService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ListBillingApplicationsResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] Guid? projectId,
        [FromQuery] Guid? ownerContractId,
        [FromQuery] BillingApplicationStatus? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        var result = await billingService.ListAsync(
            new ListBillingApplicationsQuery(projectId, ownerContractId, status, page, pageSize));
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(BillingApplicationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid id)
    {
        var result = await billingService.GetAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpPost]
    [ProducesResponseType(typeof(BillingApplicationDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateBillingApplicationRequest request)
    {
        CreateBillingApplicationCommand command = new(
            OwnerContractId: request.OwnerContractId,
            OwnerScheduleOfValuesId: request.OwnerScheduleOfValuesId,
            PeriodFrom: request.PeriodFrom,
            PeriodThrough: request.PeriodThrough,
            ApplicationDate: request.ApplicationDate);

        var result = await billingService.CreateAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(Get), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPost("{id:guid}/recalculate")]
    [ProducesResponseType(typeof(BillingApplicationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Recalculate(Guid id)
    {
        var result = await billingService.RecalculateAsync(id);
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

    [HttpPut("{billingApplicationId:guid}/lines/{lineItemId:guid}")]
    [ProducesResponseType(typeof(BillingApplicationLineItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateLine(Guid billingApplicationId, Guid lineItemId, [FromBody] UpdateBillingLineRequest request)
    {
        UpdateBillingApplicationLineCommand command = new(
            BillingApplicationId: billingApplicationId,
            LineItemId: lineItemId,
            WorkCompletedThisPeriod: request.WorkCompletedThisPeriod,
            MaterialsStoredToDate: request.MaterialsStoredToDate);

        var result = await billingService.UpdateLineAsync(command);
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

    [HttpPut("{billingApplicationId:guid}/lines")]
    [ProducesResponseType(typeof(BillingApplicationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> BulkUpdateLines(Guid billingApplicationId, [FromBody] BulkUpdateBillingLinesRequest request)
    {
        BulkUpdateBillingLinesCommand command = new(
            BillingApplicationId: billingApplicationId,
            Lines: request.Lines.Select(l => new BulkLineUpdate(l.LineItemId, l.WorkCompletedThisPeriod, l.MaterialsStoredToDate)).ToList());

        var result = await billingService.BulkUpdateLinesAsync(command);
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

    // ── Workflow ──

    [HttpPost("{id:guid}/submit-for-review")]
    [ProducesResponseType(typeof(BillingApplicationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SubmitForReview(Guid id)
    {
        var result = await billingService.SubmitForReviewAsync(id);
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

    [HttpPost("{id:guid}/approve")]
    [ProducesResponseType(typeof(BillingApplicationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Approve(Guid id)
    {
        var result = await billingService.ApproveReviewAsync(id);
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

    [HttpPost("{id:guid}/reject")]
    [ProducesResponseType(typeof(BillingApplicationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Reject(Guid id, [FromBody] RejectBillingRequest? request)
    {
        var result = await billingService.RejectReviewAsync(id, request?.Comments);
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

    [HttpPost("{id:guid}/submit-to-owner")]
    [ProducesResponseType(typeof(BillingApplicationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SubmitToOwner(Guid id)
    {
        var result = await billingService.SubmitToOwnerAsync(id);
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

    [HttpPost("{id:guid}/void")]
    [ProducesResponseType(typeof(BillingApplicationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Void(Guid id)
    {
        var result = await billingService.VoidAsync(id);
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
}

// ── Request Records ──

public record CreateBillingApplicationRequest(
    Guid OwnerContractId,
    Guid OwnerScheduleOfValuesId,
    DateOnly PeriodFrom,
    DateOnly PeriodThrough,
    DateOnly ApplicationDate
);

public record UpdateBillingLineRequest(
    decimal WorkCompletedThisPeriod,
    decimal MaterialsStoredToDate
);

public record BulkUpdateBillingLinesRequest(
    IReadOnlyList<BulkLineUpdateRequest> Lines
);

public record BulkLineUpdateRequest(
    Guid LineItemId,
    decimal WorkCompletedThisPeriod,
    decimal MaterialsStoredToDate
);

public record RejectBillingRequest(
    string? Comments = null
);
