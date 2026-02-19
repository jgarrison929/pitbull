using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Billing.Features.VendorInvoices;
using Pitbull.Billing.Services;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/vendor-invoices")]
[Authorize(Roles = "Admin")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Vendor Invoices")]
public class VendorInvoicesController(IVendorInvoiceService vendorInvoiceService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ListVendorInvoicesResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> List(
        [FromQuery] VendorInvoiceStatus? status,
        [FromQuery] Guid? vendorId,
        [FromQuery] Guid? purchaseOrderId,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        ListVendorInvoicesQuery query = new(status, vendorId, purchaseOrderId, search, page, pageSize);
        var result = await vendorInvoiceService.GetVendorInvoicesAsync(query);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(VendorInvoiceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await vendorInvoiceService.GetVendorInvoiceAsync(id);

        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpPost]
    [ProducesResponseType(typeof(VendorInvoiceDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Create([FromBody] CreateVendorInvoiceRequest request)
    {
        CreateVendorInvoiceCommand command = new(
            VendorId: request.VendorId,
            InvoiceNumber: request.InvoiceNumber,
            InvoiceDate: request.InvoiceDate,
            DueDate: request.DueDate,
            TotalAmount: request.TotalAmount,
            PurchaseOrderId: request.PurchaseOrderId);

        var result = await vendorInvoiceService.CreateVendorInvoiceAsync(command);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(VendorInvoiceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateVendorInvoiceRequest request)
    {
        UpdateVendorInvoiceCommand command = new(
            VendorInvoiceId: id,
            VendorId: request.VendorId,
            InvoiceNumber: request.InvoiceNumber,
            InvoiceDate: request.InvoiceDate,
            DueDate: request.DueDate,
            TotalAmount: request.TotalAmount,
            Status: request.Status,
            PurchaseOrderId: request.PurchaseOrderId,
            ClearPurchaseOrderId: request.ClearPurchaseOrderId);

        var result = await vendorInvoiceService.UpdateVendorInvoiceAsync(command);
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

    [HttpPost("{id:guid}/match")]
    [ProducesResponseType(typeof(InvoiceMatchResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Match(Guid id, [FromBody] MatchVendorInvoiceRequest? request)
    {
        MatchVendorInvoiceCommand command = new(
            VendorInvoiceId: id,
            TolerancePercent: request?.TolerancePercent);

        var result = await vendorInvoiceService.MatchVendorInvoiceAsync(command);
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
        var result = await vendorInvoiceService.DeleteVendorInvoiceAsync(id);

        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return NoContent();
    }
}

public record CreateVendorInvoiceRequest(
    Guid VendorId,
    string InvoiceNumber,
    DateOnly InvoiceDate,
    DateOnly DueDate,
    decimal TotalAmount,
    Guid? PurchaseOrderId = null
);

public record UpdateVendorInvoiceRequest(
    Guid? VendorId = null,
    string? InvoiceNumber = null,
    DateOnly? InvoiceDate = null,
    DateOnly? DueDate = null,
    decimal? TotalAmount = null,
    VendorInvoiceStatus? Status = null,
    Guid? PurchaseOrderId = null,
    bool ClearPurchaseOrderId = false
);

public record MatchVendorInvoiceRequest(decimal? TolerancePercent = null);
