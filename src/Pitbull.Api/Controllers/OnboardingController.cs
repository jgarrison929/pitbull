using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Extensions;
using Pitbull.Api.Services;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Manages the customer onboarding flow: status checks, checklist tracking, and welcome tour.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
public class OnboardingController(
    IOnboardingService onboardingService,
    IWelcomeService welcomeService,
    ITenantProvisioningService provisioningService,
    ICompanyContext companyContext) : ControllerBase
{
    /// <summary>
    /// Get the current user's onboarding status.
    /// Used by the frontend to decide whether to redirect to setup wizard.
    /// </summary>
    [HttpGet("status")]
    [ProducesResponseType(typeof(OnboardingStatusDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOnboardingStatus(CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null) return this.UnauthorizedError();

        var status = await onboardingService.GetOnboardingStatusAsync(userId.Value, ct);
        return Ok(status);
    }

    /// <summary>
    /// Get or create the onboarding checklist for the current user and company.
    /// </summary>
    [HttpGet("checklist")]
    [ProducesResponseType(typeof(OnboardingChecklistDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetChecklist(CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null) return this.UnauthorizedError();
        if (!companyContext.IsResolved) return this.BadRequestError("Company context required");

        var checklist = await onboardingService.GetOrCreateChecklistAsync(userId.Value, companyContext.CompanyId, ct);
        return Ok(checklist);
    }

    /// <summary>
    /// Update a specific checklist item.
    /// </summary>
    [HttpPut("checklist/{itemName}")]
    [ProducesResponseType(typeof(OnboardingChecklistDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateChecklistItem(string itemName, [FromBody] UpdateChecklistItemRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null) return this.UnauthorizedError();
        if (!companyContext.IsResolved) return this.BadRequestError("Company context required");

        try
        {
            var checklist = await onboardingService.UpdateChecklistItemAsync(
                userId.Value, companyContext.CompanyId, itemName, request.Completed, ct);
            return Ok(checklist);
        }
        catch (ArgumentException ex)
        {
            return this.BadRequestError(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return this.NotFoundError(ex.Message);
        }
    }

    /// <summary>
    /// Dismiss the onboarding checklist (user chose to hide it).
    /// </summary>
    [HttpPost("checklist/dismiss")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DismissChecklist(CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null) return this.UnauthorizedError();
        if (!companyContext.IsResolved) return this.BadRequestError("Company context required");

        await onboardingService.DismissChecklistAsync(userId.Value, companyContext.CompanyId, ct);
        return NoContent();
    }

    /// <summary>
    /// Provision the current tenant with default seed data (cost codes, permissions).
    /// Called after company setup wizard completes. Idempotent.
    /// </summary>
    [HttpPost("provision")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ProvisionTenant(CancellationToken ct)
    {
        if (!companyContext.IsResolved) return this.BadRequestError("Company context required");

        var tenantId = GetTenantId();
        if (tenantId is null) return this.UnauthorizedError();

        await provisioningService.ProvisionTenantAsync(tenantId.Value, companyContext.CompanyId, ct);
        return NoContent();
    }

    // ── Welcome Tour ──

    /// <summary>
    /// Get the welcome tour state for the current user.
    /// </summary>
    [HttpGet("tour")]
    [ProducesResponseType(typeof(WelcomeTourDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTour(CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null) return this.UnauthorizedError();

        var tour = await welcomeService.GetTourAsync(userId.Value, ct);
        return Ok(tour);
    }

    /// <summary>
    /// Mark a tour step as seen.
    /// </summary>
    [HttpPost("tour/steps/{stepId}/seen")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> MarkTourStepSeen(string stepId, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null) return this.UnauthorizedError();

        await welcomeService.MarkStepSeenAsync(userId.Value, stepId, ct);
        return NoContent();
    }

    /// <summary>
    /// Mark the entire tour as complete (skip remaining steps).
    /// </summary>
    [HttpPost("tour/complete")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> CompleteTour(CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null) return this.UnauthorizedError();

        await welcomeService.CompleteTourAsync(userId.Value, ct);
        return NoContent();
    }

    /// <summary>
    /// Reset the tour (show it again).
    /// </summary>
    [HttpPost("tour/reset")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ResetTour(CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null) return this.UnauthorizedError();

        await welcomeService.ResetTourAsync(userId.Value, ct);
        return NoContent();
    }

    private Guid? GetUserId()
    {
        var id = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
        return Guid.TryParse(id, out var guid) ? guid : null;
    }

    private Guid? GetTenantId()
    {
        var id = User.FindFirst("tenant_id")?.Value;
        return Guid.TryParse(id, out var guid) ? guid : null;
    }
}

public record UpdateChecklistItemRequest(bool Completed);
