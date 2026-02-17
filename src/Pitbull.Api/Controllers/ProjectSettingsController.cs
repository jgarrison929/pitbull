using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Project settings endpoints for company-level project configuration.
/// Controls numbering format, budget requirements, phase auto-creation, and retention.
/// </summary>
[ApiController]
[Route("api/companies/settings/projects")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Companies")]
public class ProjectSettingsController(
    PitbullDbContext db,
    ICompanyContext companyContext) : ControllerBase
{
    /// <summary>
    /// Get project settings for the active company
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ProjectSettingsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get()
    {
        if (!companyContext.IsResolved)
            return NotFound(new { error = "No active company" });

        var company = await db.Companies
            .Where(c => c.Id == companyContext.CompanyId)
            .FirstOrDefaultAsync();

        if (company is null)
            return NotFound(new { error = "Company not found" });

        return Ok(MapToDto(company.ProjectSettings));
    }

    /// <summary>
    /// Update project settings for the active company
    /// </summary>
    [HttpPut]
    [ProducesResponseType(typeof(ProjectSettingsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update([FromBody] UpdateProjectSettingsRequest request)
    {
        if (!companyContext.IsResolved)
            return NotFound(new { error = "No active company" });

        var company = await db.Companies
            .Where(c => c.Id == companyContext.CompanyId)
            .FirstOrDefaultAsync();

        if (company is null)
            return NotFound(new { error = "Company not found" });

        if (request.DefaultRetentionPercent < 0 || request.DefaultRetentionPercent > 100)
            return BadRequest(new { error = "DefaultRetentionPercent must be between 0 and 100" });

        if (string.IsNullOrWhiteSpace(request.DefaultNumberingFormat))
            return BadRequest(new { error = "DefaultNumberingFormat is required" });

        var settings = company.ProjectSettings;
        settings.DefaultNumberingFormat = request.DefaultNumberingFormat;
        settings.RequireBudgetBeforeActivation = request.RequireBudgetBeforeActivation;
        settings.AutoCreatePhases = request.AutoCreatePhases;
        settings.DefaultRetentionPercent = request.DefaultRetentionPercent;

        await db.SaveChangesAsync();

        return Ok(MapToDto(settings));
    }

    private static ProjectSettingsDto MapToDto(ProjectSettings s) => new(
        DefaultNumberingFormat: s.DefaultNumberingFormat,
        RequireBudgetBeforeActivation: s.RequireBudgetBeforeActivation,
        AutoCreatePhases: s.AutoCreatePhases,
        DefaultRetentionPercent: s.DefaultRetentionPercent);
}

public record ProjectSettingsDto(
    string DefaultNumberingFormat,
    bool RequireBudgetBeforeActivation,
    bool AutoCreatePhases,
    decimal DefaultRetentionPercent);

public record UpdateProjectSettingsRequest(
    string DefaultNumberingFormat,
    bool RequireBudgetBeforeActivation,
    bool AutoCreatePhases,
    decimal DefaultRetentionPercent);
