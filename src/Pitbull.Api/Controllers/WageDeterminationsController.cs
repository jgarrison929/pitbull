using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Billing.Features.WageDeterminations;
using Pitbull.Billing.Services;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/payroll/wage-determinations")]
[Authorize(Roles = "Admin")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Payroll Wage Determinations")]
public class WageDeterminationsController(IWageDeterminationService wageDeterminationService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ListWageDeterminationsResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] Guid? projectId,
        [FromQuery] WageDeterminationStatus? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        ListWageDeterminationsQuery query = new(projectId, status, page, pageSize);
        var result = await wageDeterminationService.ListAsync(query);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(WageDeterminationDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await wageDeterminationService.GetAsync(id);

        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpPost]
    [ProducesResponseType(typeof(WageDeterminationDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateWageDeterminationRequest request)
    {
        CreateWageDeterminationCommand command = new(
            request.ProjectId,
            request.JurisdictionType,
            request.DeterminationNumber,
            request.SourceAgency,
            request.EffectiveDate,
            request.ExpirationDate,
            request.Status,
            request.Rates.Select(x => new CreateWageDeterminationRateInput(x.WorkClassificationId, x.BaseRate, x.FringeRate, x.TotalRate)).ToList());

        var result = await wageDeterminationService.CreateAsync(command);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(WageDeterminationDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateWageDeterminationRequest request)
    {
        UpdateWageDeterminationCommand command = new(
            id,
            request.DeterminationNumber,
            request.SourceAgency,
            request.EffectiveDate,
            request.ExpirationDate,
            request.Status,
            request.Rates?.Select(x => new CreateWageDeterminationRateInput(x.WorkClassificationId, x.BaseRate, x.FringeRate, x.TotalRate)).ToList());

        var result = await wageDeterminationService.UpdateAsync(command);

        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await wageDeterminationService.DeleteAsync(id);

        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return NoContent();
    }

    [HttpGet("lookup-rate")]
    [ProducesResponseType(typeof(ApplicableWageRateDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> LookupRate([FromQuery] Guid projectId, [FromQuery] Guid workClassificationId, [FromQuery] DateOnly workDate)
    {
        ApplicableWageRateLookup lookup = new(projectId, workClassificationId, workDate);
        var result = await wageDeterminationService.LookupRateAsync(lookup);

        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }
}

public record WageDeterminationRateRequest(Guid WorkClassificationId, decimal BaseRate, decimal FringeRate, decimal TotalRate);

public record CreateWageDeterminationRequest(
    Guid ProjectId,
    WageJurisdictionType JurisdictionType,
    string DeterminationNumber,
    string? SourceAgency,
    DateOnly EffectiveDate,
    DateOnly? ExpirationDate,
    WageDeterminationStatus Status,
    IReadOnlyList<WageDeterminationRateRequest> Rates);

public record UpdateWageDeterminationRequest(
    string? DeterminationNumber = null,
    string? SourceAgency = null,
    DateOnly? EffectiveDate = null,
    DateOnly? ExpirationDate = null,
    WageDeterminationStatus? Status = null,
    IReadOnlyList<WageDeterminationRateRequest>? Rates = null);
