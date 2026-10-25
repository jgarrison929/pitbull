using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Projects.Domain;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Timecard settings endpoints for company-level crew entry configuration.
/// Controls timecard mode (daily/weekly), required fields, and defaults.
/// </summary>
[ApiController]
[Route("api/companies/settings/time-tracking")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Companies")]
public class TimecardSettingsController(
    PitbullDbContext db,
    ICompanyContext companyContext) : ControllerBase
{
    /// <summary>
    /// Get timecard settings for the active company
    /// </summary>
    /// <remarks>
    /// Returns the crew timecard configuration including entry mode,
    /// required fields, and default project assignment.
    /// </remarks>
    /// <response code="200">Timecard settings</response>
    /// <response code="404">No active company</response>
    [HttpGet]
    [ProducesResponseType(typeof(TimecardSettingsResponse), StatusCodes.Status200OK)]
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

        return Ok(MapToResponse(company.TimecardSettings));
    }

    /// <summary>
    /// Update timecard settings for the active company
    /// </summary>
    /// <remarks>
    /// Updates crew timecard configuration. All fields are optional --
    /// only provided fields are updated.
    ///
    /// **TimecardMode:**
    /// - `daily` (0): One day at a time, ideal for crews that move between projects daily
    /// - `weekly` (1): Entire week submitted at once, for end-of-week entry
    ///
    /// **WeeklyEntryMode** (only relevant when TimecardMode is Weekly):
    /// - `simple` (0): Single Reg/OT/DT totals per employee
    /// - `detailed` (1): Day-by-day breakdown within the week (compliance-ready)
    /// </remarks>
    /// <response code="200">Updated timecard settings</response>
    /// <response code="404">No active company</response>
    [HttpPut]
    [ProducesResponseType(typeof(TimecardSettingsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update([FromBody] UpdateTimecardSettingsRequest request)
    {
        if (!companyContext.IsResolved)
            return NotFound(new { error = "No active company" });

        var company = await db.Companies
            .Where(c => c.Id == companyContext.CompanyId)
            .FirstOrDefaultAsync();

        if (company is null)
            return NotFound(new { error = "Company not found" });

        // Validate enum values
        if (!Enum.IsDefined(typeof(TimecardMode), request.TimecardMode))
            return BadRequest(new { error = $"Invalid TimecardMode value: {(int)request.TimecardMode}" });
        if (!Enum.IsDefined(typeof(WeeklyEntryMode), request.WeeklyEntryMode))
            return BadRequest(new { error = $"Invalid WeeklyEntryMode value: {(int)request.WeeklyEntryMode}" });

        // Validate DefaultProjectId exists and belongs to this tenant
        if (request.DefaultProjectId is not null)
        {
            var projectExists = await db.Set<Project>().AnyAsync(p => p.Id == request.DefaultProjectId);
            if (!projectExists)
                return BadRequest(new { error = "DefaultProjectId does not refer to a valid project" });
        }

        var settings = company.TimecardSettings;

        // PUT replaces all settings. Apply all fields from request.
        if (request.WeekStartDay < 0 || request.WeekStartDay > 6)
            return BadRequest(new { error = "WeekStartDay must be between 0 (Sunday) and 6 (Saturday)" });

        settings.TimecardMode = request.TimecardMode;
        settings.WeeklyEntryMode = request.WeeklyEntryMode;
        settings.DefaultProjectId = request.DefaultProjectId;
        settings.RequirePhase = request.RequirePhase;
        settings.RequireEquipment = request.RequireEquipment;
        settings.WeekStartDay = request.WeekStartDay;

        await db.SaveChangesAsync();

        return Ok(MapToResponse(settings));
    }

    private static TimecardSettingsResponse MapToResponse(TimecardSettings settings) => new(
        TimecardMode: settings.TimecardMode,
        WeeklyEntryMode: settings.WeeklyEntryMode,
        DefaultProjectId: settings.DefaultProjectId,
        RequirePhase: settings.RequirePhase,
        RequireEquipment: settings.RequireEquipment,
        WeekStartDay: settings.WeekStartDay);
}

// ==========================================
// DTOs
// ==========================================

public record TimecardSettingsResponse(
    TimecardMode TimecardMode,
    WeeklyEntryMode WeeklyEntryMode,
    Guid? DefaultProjectId,
    bool RequirePhase,
    bool RequireEquipment,
    int WeekStartDay);

public record UpdateTimecardSettingsRequest(
    TimecardMode TimecardMode,
    WeeklyEntryMode WeeklyEntryMode,
    Guid? DefaultProjectId,
    bool RequirePhase,
    bool RequireEquipment,
    int WeekStartDay);
