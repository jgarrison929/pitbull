using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Billing.Features.PurchaseOrders;
using Pitbull.Billing.Services;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/purchase-orders")]
[Authorize(Policy = "AP.View")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Purchase Orders")]
public class PurchaseOrdersController(IPurchaseOrderService purchaseOrderService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ListPurchaseOrdersResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> List(
        [FromQuery] PurchaseOrderStatus? status,
        [FromQuery] Guid? vendorId,
        [FromQuery] Guid? projectId,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        ListPurchaseOrdersQuery query = new(status, vendorId, projectId, search, page, pageSize);
        var result = await purchaseOrderService.GetPurchaseOrdersAsync(query);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(PurchaseOrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await purchaseOrderService.GetPurchaseOrderAsync(id);

        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpPost]
    [ProducesResponseType(typeof(PurchaseOrderDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Create([FromBody] CreatePurchaseOrderRequest request)
    {
        CreatePurchaseOrderCommand command = new(
            ProjectId: request.ProjectId,
            VendorId: request.VendorId,
            Description: request.Description,
            Lines: request.Lines.Select(line => new CreatePurchaseOrderLineCommand(
                Description: line.Description,
                Quantity: line.Quantity,
                UnitPrice: line.UnitPrice,
                CostCodeId: line.CostCodeId)).ToList());

        var result = await purchaseOrderService.CreatePurchaseOrderAsync(command);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(PurchaseOrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePurchaseOrderRequest request)
    {
        UpdatePurchaseOrderCommand command = new(
            PurchaseOrderId: id,
            ProjectId: request.ProjectId,
            VendorId: request.VendorId,
            Description: request.Description,
            Lines: request.Lines?.Select(line => new CreatePurchaseOrderLineCommand(
                Description: line.Description,
                Quantity: line.Quantity,
                UnitPrice: line.UnitPrice,
                CostCodeId: line.CostCodeId)).ToList(),
            Status: request.Status);

        var result = await purchaseOrderService.UpdatePurchaseOrderAsync(command);
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
    [ProducesResponseType(typeof(PurchaseOrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Approve(Guid id)
    {
        var approvedById = GetCurrentUserId();
        if (approvedById is null) return Unauthorized(new { error = "Valid user identity required" });
        var result = await purchaseOrderService.ApprovePurchaseOrderAsync(id, approvedById.Value);

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

    [HttpPost("{id:guid}/receive")]
    [ProducesResponseType(typeof(PurchaseOrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Receive(Guid id, [FromBody] ReceivePurchaseOrderRequest request)
    {
        ReceivePurchaseOrderCommand command = new(
            PurchaseOrderId: id,
            Lines: request.Lines.Select(line => new PurchaseOrderReceiveLineCommand(
                PurchaseOrderLineId: line.PurchaseOrderLineId,
                ReceivedQuantity: line.ReceivedQuantity)).ToList());

        var result = await purchaseOrderService.ReceivePurchaseOrderAsync(command);

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
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await purchaseOrderService.DeletePurchaseOrderAsync(id);

        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return NoContent();
    }

    private Guid? GetCurrentUserId()
    {
        string? userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(userId, out Guid parsed) ? parsed : null;
    }
}

public record CreatePurchaseOrderRequest(
    Guid ProjectId,
    Guid VendorId,
    string? Description,
    List<CreatePurchaseOrderLineRequest> Lines
);

public record CreatePurchaseOrderLineRequest(
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    Guid? CostCodeId = null
);

public record UpdatePurchaseOrderRequest(
    Guid? ProjectId = null,
    Guid? VendorId = null,
    string? Description = null,
    List<CreatePurchaseOrderLineRequest>? Lines = null,
    PurchaseOrderStatus? Status = null
);

public record ReceivePurchaseOrderRequest(List<ReceivePurchaseOrderLineRequest> Lines);

public record ReceivePurchaseOrderLineRequest(
    Guid PurchaseOrderLineId,
    decimal ReceivedQuantity
);
