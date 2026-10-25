using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Billing.Features.Vendors;
using Pitbull.Billing.Services;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/vendors")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Vendors")]
public class VendorsController(IVendorService vendorService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ListVendorsResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> List(
        [FromQuery] string? search,
        [FromQuery] bool? isActive,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        ListVendorsQuery query = new(search, isActive, page, pageSize);
        var result = await vendorService.GetVendorsAsync(query);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(VendorDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await vendorService.GetVendorAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpPost]
    [ProducesResponseType(typeof(VendorDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Create([FromBody] CreateVendorRequest request)
    {
        CreateVendorCommand command = new(
            Name: request.Name,
            Code: request.Code,
            TaxId: request.TaxId,
            ContactName: request.ContactName,
            ContactEmail: request.ContactEmail,
            Phone: request.Phone,
            Address: request.Address,
            City: request.City,
            State: request.State,
            Zip: request.Zip,
            InsuranceExpDate: request.InsuranceExpDate,
            W9OnFile: request.W9OnFile,
            MinorityWbeStatus: request.MinorityWbeStatus,
            TradeClassification: request.TradeClassification,
            PaymentTerms: request.PaymentTerms,
            IsActive: request.IsActive
        );

        var result = await vendorService.CreateVendorAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(VendorDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateVendorRequest request)
    {
        UpdateVendorCommand command = new(
            VendorId: id,
            Name: request.Name,
            Code: request.Code,
            TaxId: request.TaxId,
            ContactName: request.ContactName,
            ContactEmail: request.ContactEmail,
            Phone: request.Phone,
            Address: request.Address,
            City: request.City,
            State: request.State,
            Zip: request.Zip,
            InsuranceExpDate: request.InsuranceExpDate,
            W9OnFile: request.W9OnFile,
            MinorityWbeStatus: request.MinorityWbeStatus,
            TradeClassification: request.TradeClassification,
            PaymentTerms: request.PaymentTerms,
            IsActive: request.IsActive
        );

        var result = await vendorService.UpdateVendorAsync(command);
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
        var result = await vendorService.DeleteVendorAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return NoContent();
    }
}

public record CreateVendorRequest(
    string Name,
    string Code,
    string? TaxId = null,
    string? ContactName = null,
    string? ContactEmail = null,
    string? Phone = null,
    string? Address = null,
    string? City = null,
    string? State = null,
    string? Zip = null,
    DateOnly? InsuranceExpDate = null,
    bool W9OnFile = false,
    string? MinorityWbeStatus = null,
    string? TradeClassification = null,
    string? PaymentTerms = null,
    bool IsActive = true
);

public record UpdateVendorRequest(
    string? Name = null,
    string? Code = null,
    string? TaxId = null,
    string? ContactName = null,
    string? ContactEmail = null,
    string? Phone = null,
    string? Address = null,
    string? City = null,
    string? State = null,
    string? Zip = null,
    DateOnly? InsuranceExpDate = null,
    bool? W9OnFile = null,
    string? MinorityWbeStatus = null,
    string? TradeClassification = null,
    string? PaymentTerms = null,
    bool? IsActive = null
);
