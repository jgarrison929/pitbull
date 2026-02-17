using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Bid settings endpoints for company-level estimating configuration.
/// Controls default validity, estimator sign-off, and markup percentages.
/// </summary>
[ApiController]
[Route("api/companies/settings/bids")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Companies")]
public class BidSettingsController(
    PitbullDbContext db,
    ICompanyContext companyContext) : ControllerBase
{
    /// <summary>
    /// Get bid settings for the active company
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(BidSettingsDto), StatusCodes.Status200OK)]
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

        return Ok(MapToDto(company.BidSettings));
    }

    /// <summary>
    /// Update bid settings for the active company
    /// </summary>
    [HttpPut]
    [ProducesResponseType(typeof(BidSettingsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update([FromBody] UpdateBidSettingsRequest request)
    {
        if (!companyContext.IsResolved)
            return NotFound(new { error = "No active company" });

        var company = await db.Companies
            .Where(c => c.Id == companyContext.CompanyId && !c.IsDeleted)
            .FirstOrDefaultAsync();

        if (company is null)
            return NotFound(new { error = "Company not found" });

        if (request.DefaultValidityPeriodDays < 1 || request.DefaultValidityPeriodDays > 365)
            return BadRequest(new { error = "DefaultValidityPeriodDays must be between 1 and 365" });

        if (request.DefaultOverheadPercent < 0 || request.DefaultOverheadPercent > 100)
            return BadRequest(new { error = "DefaultOverheadPercent must be between 0 and 100" });

        if (request.DefaultProfitPercent < 0 || request.DefaultProfitPercent > 100)
            return BadRequest(new { error = "DefaultProfitPercent must be between 0 and 100" });

        var settings = company.BidSettings;
        settings.DefaultValidityPeriodDays = request.DefaultValidityPeriodDays;
        settings.RequireEstimatorSignOff = request.RequireEstimatorSignOff;
        settings.DefaultOverheadPercent = request.DefaultOverheadPercent;
        settings.DefaultProfitPercent = request.DefaultProfitPercent;

        await db.SaveChangesAsync();

        return Ok(MapToDto(settings));
    }

    private static BidSettingsDto MapToDto(BidSettings s) => new(
        DefaultValidityPeriodDays: s.DefaultValidityPeriodDays,
        RequireEstimatorSignOff: s.RequireEstimatorSignOff,
        DefaultOverheadPercent: s.DefaultOverheadPercent,
        DefaultProfitPercent: s.DefaultProfitPercent);
}

public record BidSettingsDto(
    int DefaultValidityPeriodDays,
    bool RequireEstimatorSignOff,
    decimal DefaultOverheadPercent,
    decimal DefaultProfitPercent);

public record UpdateBidSettingsRequest(
    int DefaultValidityPeriodDays,
    bool RequireEstimatorSignOff,
    decimal DefaultOverheadPercent,
    decimal DefaultProfitPercent);
