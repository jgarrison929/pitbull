using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Billing.Features.Customers;
using Pitbull.Billing.Services;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/customers")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Customers")]
public class CustomersController(ICustomerService customerService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ListCustomersResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> List(
        [FromQuery] string? search,
        [FromQuery] bool? isActive,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        ListCustomersQuery query = new(search, isActive, page, pageSize);
        var result = await customerService.GetCustomersAsync(query);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(CustomerDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await customerService.GetCustomerAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpPost]
    [ProducesResponseType(typeof(CustomerDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Create([FromBody] CreateCustomerRequest request)
    {
        CreateCustomerCommand command = new(
            Name: request.Name,
            Code: request.Code,
            ContactName: request.ContactName,
            ContactEmail: request.ContactEmail,
            Phone: request.Phone,
            Address: request.Address,
            City: request.City,
            State: request.State,
            Zip: request.Zip,
            PaymentTerms: request.PaymentTerms,
            CreditLimit: request.CreditLimit,
            IsActive: request.IsActive
        );

        var result = await customerService.CreateCustomerAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(CustomerDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCustomerRequest request)
    {
        UpdateCustomerCommand command = new(
            CustomerId: id,
            Name: request.Name,
            Code: request.Code,
            ContactName: request.ContactName,
            ContactEmail: request.ContactEmail,
            Phone: request.Phone,
            Address: request.Address,
            City: request.City,
            State: request.State,
            Zip: request.Zip,
            PaymentTerms: request.PaymentTerms,
            CreditLimit: request.CreditLimit,
            IsActive: request.IsActive
        );

        var result = await customerService.UpdateCustomerAsync(command);
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
        var result = await customerService.DeleteCustomerAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return NoContent();
    }
}

public record CreateCustomerRequest(
    string Name,
    string Code,
    string? ContactName = null,
    string? ContactEmail = null,
    string? Phone = null,
    string? Address = null,
    string? City = null,
    string? State = null,
    string? Zip = null,
    string? PaymentTerms = null,
    decimal? CreditLimit = null,
    bool IsActive = true
);

public record UpdateCustomerRequest(
    string? Name = null,
    string? Code = null,
    string? ContactName = null,
    string? ContactEmail = null,
    string? Phone = null,
    string? Address = null,
    string? City = null,
    string? State = null,
    string? Zip = null,
    string? PaymentTerms = null,
    decimal? CreditLimit = null,
    bool? IsActive = null
);
