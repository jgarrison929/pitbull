using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Billing.Features.Retention;
using Pitbull.Billing.Services;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/retention")]
[Authorize(Policy = "Billing.ReleaseRetention")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Retention")]
public class RetentionController(IRetentionService retentionService) : ControllerBase
{
    // ── Policies ──

    [HttpGet("policies")]
    [ProducesResponseType(typeof(ListRetentionPoliciesResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListPolicies(
        [FromQuery] bool? isActive,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        var result = await retentionService.GetPoliciesAsync(new ListRetentionPoliciesQuery(isActive, page, pageSize));
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpGet("policies/{id:guid}")]
    [ProducesResponseType(typeof(RetentionPolicyDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPolicy(Guid id)
    {
        var result = await retentionService.GetPolicyAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpPost("policies")]
    [ProducesResponseType(typeof(RetentionPolicyDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreatePolicy([FromBody] CreateRetentionPolicyRequest request)
    {
        CreateRetentionPolicyCommand command = new(
            Name: request.Name,
            PercentageRate: request.PercentageRate,
            MaxAmount: request.MaxAmount,
            ReleaseThreshold: request.ReleaseThreshold,
            AppliesTo: request.AppliesTo,
            IsDefault: request.IsDefault);

        var result = await retentionService.CreatePolicyAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetPolicy), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPut("policies/{id:guid}")]
    [ProducesResponseType(typeof(RetentionPolicyDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdatePolicy(Guid id, [FromBody] UpdateRetentionPolicyRequest request)
    {
        UpdateRetentionPolicyCommand command = new(
            PolicyId: id,
            Name: request.Name,
            PercentageRate: request.PercentageRate,
            MaxAmount: request.MaxAmount,
            ReleaseThreshold: request.ReleaseThreshold,
            AppliesTo: request.AppliesTo,
            IsDefault: request.IsDefault,
            IsActive: request.IsActive);

        var result = await retentionService.UpdatePolicyAsync(command);
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

    [HttpDelete("policies/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeletePolicy(Guid id)
    {
        var result = await retentionService.DeletePolicyAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return NoContent();
    }

    // ── Holds ──

    [HttpGet("holds")]
    [ProducesResponseType(typeof(ListRetentionHoldsResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListHolds(
        [FromQuery] Guid? projectId,
        [FromQuery] RetentionHoldStatus? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        var result = await retentionService.GetHoldsAsync(new ListRetentionHoldsQuery(projectId, status, page, pageSize));
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpGet("holds/{id:guid}")]
    [ProducesResponseType(typeof(RetentionHoldDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetHold(Guid id)
    {
        var result = await retentionService.GetHoldAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpPost("holds")]
    [ProducesResponseType(typeof(RetentionHoldDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateHold([FromBody] CreateRetentionHoldRequest request)
    {
        CreateRetentionHoldCommand command = new(
            ProjectId: request.ProjectId,
            ContractId: request.ContractId,
            OriginalAmount: request.OriginalAmount,
            RetainagePercent: request.RetainagePercent,
            Description: request.Description,
            RetentionPolicyId: request.RetentionPolicyId,
            EffectiveDate: request.EffectiveDate);

        var result = await retentionService.CreateHoldAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetHold), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPost("holds/{id:guid}/release")]
    [ProducesResponseType(typeof(RetentionHoldDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReleaseRetention(Guid id, [FromBody] ReleaseRetentionRequest request)
    {
        Guid userId = GetCurrentUserId();
        ReleaseRetentionCommand command = new(
            HoldId: id,
            ReleaseAmount: request.ReleaseAmount,
            ReleasedByUserId: userId);

        var result = await retentionService.ReleaseRetentionAsync(command);
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

    private Guid GetCurrentUserId()
    {
        string? userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(userId, out Guid parsed) ? parsed : Guid.Empty;
    }
}

// ── Request Records ──

public record CreateRetentionPolicyRequest(
    string Name,
    decimal PercentageRate,
    decimal? MaxAmount = null,
    decimal? ReleaseThreshold = null,
    RetentionAppliesTo AppliesTo = RetentionAppliesTo.Both,
    bool IsDefault = false
);

public record UpdateRetentionPolicyRequest(
    string? Name = null,
    decimal? PercentageRate = null,
    decimal? MaxAmount = null,
    decimal? ReleaseThreshold = null,
    RetentionAppliesTo? AppliesTo = null,
    bool? IsDefault = null,
    bool? IsActive = null
);

public record CreateRetentionHoldRequest(
    Guid ProjectId,
    Guid? ContractId,
    decimal OriginalAmount,
    decimal RetainagePercent,
    string? Description = null,
    Guid? RetentionPolicyId = null,
    DateOnly? EffectiveDate = null
);

public record ReleaseRetentionRequest(
    decimal ReleaseAmount
);
