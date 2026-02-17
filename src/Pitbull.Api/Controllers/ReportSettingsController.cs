using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Report settings endpoints for company-level reporting configuration.
/// Controls overtime rules, branding, and fiscal year.
/// </summary>
[ApiController]
[Route("api/companies/settings/reports")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Companies")]
public class ReportSettingsController(
    PitbullDbContext db,
    ICompanyContext companyContext) : ControllerBase
{
    /// <summary>
    /// Get report settings for the active company
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ReportSettingsDto), StatusCodes.Status200OK)]
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

        return Ok(MapToDto(company.ReportSettings));
    }

    /// <summary>
    /// Update report settings for the active company
    /// </summary>
    [HttpPut]
    [ProducesResponseType(typeof(ReportSettingsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update([FromBody] UpdateReportSettingsRequest request)
    {
        if (!companyContext.IsResolved)
            return NotFound(new { error = "No active company" });

        var company = await db.Companies
            .Where(c => c.Id == companyContext.CompanyId && !c.IsDeleted)
            .FirstOrDefaultAsync();

        if (company is null)
            return NotFound(new { error = "Company not found" });

        var validOvertimeRules = new[] { "Federal", "California" };
        if (!validOvertimeRules.Contains(request.OvertimeRules))
            return BadRequest(new { error = $"OvertimeRules must be one of: {string.Join(", ", validOvertimeRules)}" });

        if (request.FiscalYearStartMonth < 1 || request.FiscalYearStartMonth > 12)
            return BadRequest(new { error = "FiscalYearStartMonth must be between 1 and 12" });

        var settings = company.ReportSettings;
        settings.OvertimeRules = request.OvertimeRules;
        settings.ReportBrandingName = request.ReportBrandingName;
        settings.ReportLogoUrl = request.ReportLogoUrl;
        settings.FiscalYearStartMonth = request.FiscalYearStartMonth;

        await db.SaveChangesAsync();

        return Ok(MapToDto(settings));
    }

    private static ReportSettingsDto MapToDto(ReportSettings s) => new(
        OvertimeRules: s.OvertimeRules,
        ReportBrandingName: s.ReportBrandingName,
        ReportLogoUrl: s.ReportLogoUrl,
        FiscalYearStartMonth: s.FiscalYearStartMonth);
}

public record ReportSettingsDto(
    string OvertimeRules,
    string ReportBrandingName,
    string ReportLogoUrl,
    int FiscalYearStartMonth);

public record UpdateReportSettingsRequest(
    string OvertimeRules,
    string ReportBrandingName,
    string ReportLogoUrl,
    int FiscalYearStartMonth);
