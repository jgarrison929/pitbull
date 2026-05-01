using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Billing.Features.VendorPayments;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/vendor-payments")]
[Authorize(Policy = "AP.View")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Vendor Payments")]
public class VendorPaymentsController(
    IVendorPaymentService vendorPaymentService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ListVendorPaymentsResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> List(
        [FromQuery] VendorPaymentStatus? status,
        [FromQuery] Guid? vendorId,
        [FromQuery] PaymentMethod? paymentMethod,
        [FromQuery] DateOnly? startDate,
        [FromQuery] DateOnly? endDate,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        ListVendorPaymentsQuery query = new(status, vendorId, paymentMethod, startDate, endDate, search, page, pageSize);
        var result = await vendorPaymentService.GetVendorPaymentsAsync(query);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(VendorPaymentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await vendorPaymentService.GetVendorPaymentAsync(id);

        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpPost]
    [ProducesResponseType(typeof(VendorPaymentDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Create([FromBody] CreateVendorPaymentRequest request)
    {
        CreateVendorPaymentCommand command = new(
            VendorId: request.VendorId,
            PaymentDate: request.PaymentDate,
            PaymentMethod: request.PaymentMethod,
            ReferenceNumber: request.ReferenceNumber,
            BankAccountId: request.BankAccountId,
            Memo: request.Memo,
            Applications: request.Applications?.Select(a =>
                new PaymentApplicationLineCommand(a.VendorInvoiceId, a.AppliedAmount)).ToList());

        var result = await vendorPaymentService.CreateVendorPaymentAsync(command);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(VendorPaymentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateVendorPaymentRequest request)
    {
        UpdateVendorPaymentCommand command = new(
            VendorPaymentId: id,
            PaymentDate: request.PaymentDate,
            PaymentMethod: request.PaymentMethod,
            ReferenceNumber: request.ReferenceNumber,
            BankAccountId: request.BankAccountId,
            ClearBankAccountId: request.ClearBankAccountId,
            Memo: request.Memo,
            Applications: request.Applications?.Select(a =>
                new PaymentApplicationLineCommand(a.VendorInvoiceId, a.AppliedAmount)).ToList());

        var result = await vendorPaymentService.UpdateVendorPaymentAsync(command);

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
    [ProducesResponseType(typeof(VendorPaymentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Approve(Guid id)
    {
        var result = await vendorPaymentService.ApproveVendorPaymentAsync(new ApproveVendorPaymentCommand(id));

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

    [HttpPost("{id:guid}/post")]
    [ProducesResponseType(typeof(VendorPaymentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Post(Guid id, [FromBody] PostVendorPaymentRequest request)
    {
        // Get user ID from claims
        var userIdClaim = User.FindFirst("sub") ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        Guid userId = userIdClaim is not null && Guid.TryParse(userIdClaim.Value, out var uid) ? uid : Guid.Empty;

        PostVendorPaymentCommand command = new(
            VendorPaymentId: id,
            PostedByUserId: userId,
            ApAccountId: request.ApAccountId,
            CashAccountId: request.CashAccountId);

        var result = await vendorPaymentService.PostVendorPaymentAsync(command);

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
    [ProducesResponseType(typeof(VendorPaymentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Void(Guid id, [FromBody] VoidVendorPaymentRequest? request)
    {
        var result = await vendorPaymentService.VoidVendorPaymentAsync(
            new VoidVendorPaymentCommand(id, request?.Reason));

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
        var result = await vendorPaymentService.DeleteVendorPaymentAsync(id);

        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return NoContent();
    }
}

public record CreateVendorPaymentRequest(
    Guid VendorId,
    DateOnly PaymentDate,
    PaymentMethod PaymentMethod,
    string? ReferenceNumber = null,
    Guid? BankAccountId = null,
    string? Memo = null,
    List<PaymentApplicationLineRequest>? Applications = null
);

public record PaymentApplicationLineRequest(
    Guid VendorInvoiceId,
    decimal AppliedAmount
);

public record UpdateVendorPaymentRequest(
    DateOnly? PaymentDate = null,
    PaymentMethod? PaymentMethod = null,
    string? ReferenceNumber = null,
    Guid? BankAccountId = null,
    bool ClearBankAccountId = false,
    string? Memo = null,
    List<PaymentApplicationLineRequest>? Applications = null
);

public record PostVendorPaymentRequest(
    Guid ApAccountId,
    Guid CashAccountId
);

public record VoidVendorPaymentRequest(
    string? Reason = null
);
