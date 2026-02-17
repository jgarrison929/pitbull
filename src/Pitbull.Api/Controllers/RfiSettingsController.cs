using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Api.Controllers;

/// <summary>
/// RFI settings endpoints for company-level RFI workflow configuration.
/// Controls response deadlines, auto-assignment, and cost impact requirements.
/// </summary>
[ApiController]
[Route("api/companies/settings/rfis")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Companies")]
public class RfiSettingsController(
    PitbullDbContext db,
    ICompanyContext companyContext) : ControllerBase
{
    /// <summary>
    /// Get RFI settings for the active company
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(RfiSettingsDto), StatusCodes.Status200OK)]
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

        return Ok(MapToDto(company.RfiSettings));
    }

    /// <summary>
    /// Update RFI settings for the active company
    /// </summary>
    [HttpPut]
    [ProducesResponseType(typeof(RfiSettingsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update([FromBody] UpdateRfiSettingsRequest request)
    {
        if (!companyContext.IsResolved)
            return NotFound(new { error = "No active company" });

        var company = await db.Companies
            .Where(c => c.Id == companyContext.CompanyId && !c.IsDeleted)
            .FirstOrDefaultAsync();

        if (company is null)
            return NotFound(new { error = "Company not found" });

        if (request.DefaultResponseDeadlineDays < 1 || request.DefaultResponseDeadlineDays > 365)
            return BadRequest(new { error = "DefaultResponseDeadlineDays must be between 1 and 365" });

        var settings = company.RfiSettings;
        settings.DefaultResponseDeadlineDays = request.DefaultResponseDeadlineDays;
        settings.AutoAssignToPm = request.AutoAssignToPm;
        settings.RequireCostImpact = request.RequireCostImpact;

        await db.SaveChangesAsync();

        return Ok(MapToDto(settings));
    }

    private static RfiSettingsDto MapToDto(RfiSettings s) => new(
        DefaultResponseDeadlineDays: s.DefaultResponseDeadlineDays,
        AutoAssignToPm: s.AutoAssignToPm,
        RequireCostImpact: s.RequireCostImpact);
}

public record RfiSettingsDto(
    int DefaultResponseDeadlineDays,
    bool AutoAssignToPm,
    bool RequireCostImpact);

public record UpdateRfiSettingsRequest(
    int DefaultResponseDeadlineDays,
    bool AutoAssignToPm,
    bool RequireCostImpact);
