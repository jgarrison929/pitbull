using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Features;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Payment application settings endpoints for company-level retainage and workflow configuration.
/// </summary>
[ApiController]
[Route("api/companies/settings/payment-applications")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Companies")]
public class PaymentApplicationSettingsController(
    PitbullDbContext db,
    ICompanyContext companyContext) : ControllerBase
{
    /// <summary>
    /// Get payment application settings for the active company
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PaymentApplicationSettingsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get()
    {
        if (!companyContext.IsResolved)
            return NotFound(new { error = "No active company" });

        var company = await db.Companies
            .Where(c => c.Id == companyContext.CompanyId && !c.IsDeleted)
            .FirstOrDefaultAsync();

        if (company is null)
            return NotFound(new { error = "Company not found" });

        return Ok(MapToDto(company.PaymentApplicationSettings));
    }

    /// <summary>
    /// Update payment application settings for the active company
    /// </summary>
    [HttpPut]
    [ProducesResponseType(typeof(PaymentApplicationSettingsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update([FromBody] UpdatePaymentApplicationSettingsRequest request)
    {
        if (!companyContext.IsResolved)
            return NotFound(new { error = "No active company" });

        var company = await db.Companies
            .Where(c => c.Id == companyContext.CompanyId && !c.IsDeleted)
            .FirstOrDefaultAsync();

        if (company is null)
            return NotFound(new { error = "Company not found" });

        if (request.DefaultRetainagePercent < 0 || request.DefaultRetainagePercent > 100)
            return BadRequest(new { error = "DefaultRetainagePercent must be between 0 and 100" });

        var validBookModes = new[] { "Gaap", "BonusJobCost", "Both" };
        if (!validBookModes.Contains(request.DefaultBookMode))
            return BadRequest(new { error = $"DefaultBookMode must be one of: {string.Join(", ", validBookModes)}" });

        var settings = company.PaymentApplicationSettings;
        settings.DefaultRetainagePercent = request.DefaultRetainagePercent;
        settings.EnableApprovalWorkflow = request.EnableApprovalWorkflow;
        settings.RequireSignedSubcontract = request.RequireSignedSubcontract;
        settings.AllowRetainageOverride = request.AllowRetainageOverride;
        settings.AllowRetainageReleaseBeforeFinal = request.AllowRetainageReleaseBeforeFinal;
        settings.DefaultBookMode = request.DefaultBookMode;
        settings.LockSubmittedLineItems = request.LockSubmittedLineItems;
        settings.RequireLienWaiverBeforePaid = request.RequireLienWaiverBeforePaid;

        await db.SaveChangesAsync();

        return Ok(MapToDto(settings));
    }

    private static PaymentApplicationSettingsDto MapToDto(PaymentApplicationSettings s) => new(
        DefaultRetainagePercent: s.DefaultRetainagePercent,
        EnableApprovalWorkflow: s.EnableApprovalWorkflow,
        RequireSignedSubcontract: s.RequireSignedSubcontract,
        AllowRetainageOverride: s.AllowRetainageOverride,
        AllowRetainageReleaseBeforeFinal: s.AllowRetainageReleaseBeforeFinal,
        DefaultBookMode: s.DefaultBookMode,
        LockSubmittedLineItems: s.LockSubmittedLineItems,
        RequireLienWaiverBeforePaid: s.RequireLienWaiverBeforePaid);
}
