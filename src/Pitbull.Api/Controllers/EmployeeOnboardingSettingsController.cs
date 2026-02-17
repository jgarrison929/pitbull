using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.TimeTracking.Features;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Employee onboarding settings endpoints for company-level onboarding configuration.
/// </summary>
[ApiController]
[Route("api/companies/settings/employee-onboarding")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Companies")]
public class EmployeeOnboardingSettingsController(
    PitbullDbContext db,
    ICompanyContext companyContext) : ControllerBase
{
    /// <summary>
    /// Get employee onboarding settings for the active company
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(EmployeeOnboardingSettingsDto), StatusCodes.Status200OK)]
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

        return Ok(MapToDto(company.EmployeeOnboardingSettings));
    }

    /// <summary>
    /// Update employee onboarding settings for the active company
    /// </summary>
    [HttpPut]
    [ProducesResponseType(typeof(EmployeeOnboardingSettingsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update([FromBody] UpdateEmployeeOnboardingSettingsRequest request)
    {
        if (!companyContext.IsResolved)
            return NotFound(new { error = "No active company" });

        var company = await db.Companies
            .Where(c => c.Id == companyContext.CompanyId && !c.IsDeleted)
            .FirstOrDefaultAsync();

        if (company is null)
            return NotFound(new { error = "Company not found" });

        var settings = company.EmployeeOnboardingSettings;
        settings.Enabled = request.Enabled;
        settings.RequireApprovalWorkflow = request.RequireApprovalWorkflow;
        settings.RequireEmergencyContact = request.RequireEmergencyContact;
        settings.RequireI9 = request.RequireI9;
        settings.RequireW4 = request.RequireW4;
        settings.RequireCertifications = request.RequireCertifications;
        settings.RequiredCertificationTypes = request.RequiredCertificationTypes;
        settings.DefaultPrevailingWageClass = request.DefaultPrevailingWageClass;
        settings.EnableUnionFields = request.EnableUnionFields;

        await db.SaveChangesAsync();

        return Ok(MapToDto(settings));
    }

    private static EmployeeOnboardingSettingsDto MapToDto(EmployeeOnboardingSettings s) => new(
        Enabled: s.Enabled,
        RequireApprovalWorkflow: s.RequireApprovalWorkflow,
        RequireEmergencyContact: s.RequireEmergencyContact,
        RequireI9: s.RequireI9,
        RequireW4: s.RequireW4,
        RequireCertifications: s.RequireCertifications,
        RequiredCertificationTypes: s.RequiredCertificationTypes,
        DefaultPrevailingWageClass: s.DefaultPrevailingWageClass,
        EnableUnionFields: s.EnableUnionFields);
}
