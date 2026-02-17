using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Unified module settings endpoint. Returns all module settings in a single call
/// for the company setup wizard and settings overview.
/// </summary>
[ApiController]
[Route("api/companies/settings")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Companies")]
public class ModuleSettingsController(
    PitbullDbContext db,
    ICompanyContext companyContext) : ControllerBase
{
    /// <summary>
    /// Get all module settings for the active company in a single response.
    /// Used by the company setup wizard and settings overview page.
    /// </summary>
    [HttpGet("all")]
    [ProducesResponseType(typeof(AllModuleSettingsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetAll()
    {
        if (!companyContext.IsResolved)
            return NotFound(new { error = "No active company" });

        var company = await db.Companies
            .Where(c => c.Id == companyContext.CompanyId)
            .FirstOrDefaultAsync();

        if (company is null)
            return NotFound(new { error = "Company not found" });

        return Ok(new AllModuleSettingsDto(
            Projects: MapProjectSettings(company.ProjectSettings),
            Contracts: MapContractSettings(company.ContractSettings),
            Bids: MapBidSettings(company.BidSettings),
            Rfis: MapRfiSettings(company.RfiSettings),
            Reports: MapReportSettings(company.ReportSettings)));
    }

    private static ProjectSettingsDto MapProjectSettings(ProjectSettings s) => new(
        DefaultNumberingFormat: s.DefaultNumberingFormat,
        RequireBudgetBeforeActivation: s.RequireBudgetBeforeActivation,
        AutoCreatePhases: s.AutoCreatePhases,
        DefaultRetentionPercent: s.DefaultRetentionPercent);

    private static ContractSettingsDto MapContractSettings(ContractSettings s) => new(
        DefaultRetainagePercent: s.DefaultRetainagePercent,
        RequireSignedSubcontractBeforePayApp: s.RequireSignedSubcontractBeforePayApp,
        ApprovalWorkflowType: s.ApprovalWorkflowType,
        AiaArchitectName: s.AiaArchitectName,
        AiaOwnerName: s.AiaOwnerName);

    private static BidSettingsDto MapBidSettings(BidSettings s) => new(
        DefaultValidityPeriodDays: s.DefaultValidityPeriodDays,
        RequireEstimatorSignOff: s.RequireEstimatorSignOff,
        DefaultOverheadPercent: s.DefaultOverheadPercent,
        DefaultProfitPercent: s.DefaultProfitPercent);

    private static RfiSettingsDto MapRfiSettings(RfiSettings s) => new(
        DefaultResponseDeadlineDays: s.DefaultResponseDeadlineDays,
        AutoAssignToPm: s.AutoAssignToPm,
        RequireCostImpact: s.RequireCostImpact);

    private static ReportSettingsDto MapReportSettings(ReportSettings s) => new(
        OvertimeRules: s.OvertimeRules,
        ReportBrandingName: s.ReportBrandingName,
        ReportLogoUrl: s.ReportLogoUrl,
        FiscalYearStartMonth: s.FiscalYearStartMonth);
}

public record AllModuleSettingsDto(
    ProjectSettingsDto Projects,
    ContractSettingsDto Contracts,
    BidSettingsDto Bids,
    RfiSettingsDto Rfis,
    ReportSettingsDto Reports);
