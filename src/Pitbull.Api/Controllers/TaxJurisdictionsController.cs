using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Billing.Services;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/tax-jurisdictions")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Tax & Currency")]
// Read/calculate endpoints: any authenticated user
// CUD endpoints: Admin.Settings policy (see individual actions)
public class TaxJurisdictionsController(
    ITaxJurisdictionService jurisdictionService,
    ITaxCalculationService taxCalculationService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? state, CancellationToken ct)
    {
        var result = await jurisdictionService.ListAsync(state, ct);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });
        return Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var result = await jurisdictionService.GetAsync(id, ct);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });
        return Ok(result.Value);
    }

    [HttpPost]
    [Authorize(Policy = "Admin.Settings")]
    public async Task<IActionResult> Create([FromBody] CreateTaxJurisdictionCommand cmd, CancellationToken ct)
    {
        var result = await jurisdictionService.CreateAsync(cmd, ct);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });
        return CreatedAtAction(nameof(Get), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Admin.Settings")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTaxJurisdictionCommand cmd, CancellationToken ct)
    {
        var result = await jurisdictionService.UpdateAsync(id, cmd, ct);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });
        return Ok(result.Value);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Admin.Settings")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await jurisdictionService.DeleteAsync(id, ct);
        if (!result.IsSuccess)
            return NotFound(new { error = result.Error, code = result.ErrorCode });
        return NoContent();
    }

    [HttpPost("calculate")]
    public async Task<IActionResult> CalculateTax([FromBody] CalculateTaxRequest request, CancellationToken ct)
    {
        var result = await taxCalculationService.CalculateTaxAsync(
            request.Amount, request.JurisdictionId, request.Category,
            request.ProjectId, request.VendorId, ct);
        return Ok(result);
    }

    [HttpPost("calculate-bulk")]
    public async Task<IActionResult> CalculateBulkTax([FromBody] CalculateBulkTaxRequest request, CancellationToken ct)
    {
        var results = await taxCalculationService.CalculateBulkTaxAsync(
            request.Lines, request.JurisdictionId,
            request.ProjectId, request.VendorId, ct);
        return Ok(results);
    }
}

public record CalculateTaxRequest(
    decimal Amount,
    Guid JurisdictionId,
    Pitbull.Billing.Domain.TaxCategory Category,
    Guid? ProjectId = null,
    Guid? VendorId = null);

public record CalculateBulkTaxRequest(
    IReadOnlyList<TaxLineInput> Lines,
    Guid JurisdictionId,
    Guid? ProjectId = null,
    Guid? VendorId = null);
