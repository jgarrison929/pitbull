using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Contract settings endpoints for company-level subcontract configuration.
/// Controls retainage, approval workflows, and AIA form defaults.
/// </summary>
[ApiController]
[Route("api/companies/settings/contracts")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Companies")]
public class ContractSettingsController(
    PitbullDbContext db,
    ICompanyContext companyContext) : ControllerBase
{
    /// <summary>
    /// Get contract settings for the active company
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ContractSettingsDto), StatusCodes.Status200OK)]
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

        return Ok(MapToDto(company.ContractSettings));
    }

    /// <summary>
    /// Update contract settings for the active company
    /// </summary>
    [HttpPut]
    [ProducesResponseType(typeof(ContractSettingsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update([FromBody] UpdateContractSettingsRequest request)
    {
        if (!companyContext.IsResolved)
            return NotFound(new { error = "No active company" });

        var company = await db.Companies
            .Where(c => c.Id == companyContext.CompanyId)
            .FirstOrDefaultAsync();

        if (company is null)
            return NotFound(new { error = "Company not found" });

        if (request.DefaultRetainagePercent < 0 || request.DefaultRetainagePercent > 100)
            return BadRequest(new { error = "DefaultRetainagePercent must be between 0 and 100" });

        var validWorkflows = new[] { "None", "Sequential", "Parallel" };
        if (!validWorkflows.Contains(request.ApprovalWorkflowType))
            return BadRequest(new { error = $"ApprovalWorkflowType must be one of: {string.Join(", ", validWorkflows)}" });

        var settings = company.ContractSettings;
        settings.DefaultRetainagePercent = request.DefaultRetainagePercent;
        settings.RequireSignedSubcontractBeforePayApp = request.RequireSignedSubcontractBeforePayApp;
        settings.ApprovalWorkflowType = request.ApprovalWorkflowType;
        settings.AiaArchitectName = request.AiaArchitectName;
        settings.AiaOwnerName = request.AiaOwnerName;

        await db.SaveChangesAsync();

        return Ok(MapToDto(settings));
    }

    private static ContractSettingsDto MapToDto(ContractSettings s) => new(
        DefaultRetainagePercent: s.DefaultRetainagePercent,
        RequireSignedSubcontractBeforePayApp: s.RequireSignedSubcontractBeforePayApp,
        ApprovalWorkflowType: s.ApprovalWorkflowType,
        AiaArchitectName: s.AiaArchitectName,
        AiaOwnerName: s.AiaOwnerName);
}

public record ContractSettingsDto(
    decimal DefaultRetainagePercent,
    bool RequireSignedSubcontractBeforePayApp,
    string ApprovalWorkflowType,
    string AiaArchitectName,
    string AiaOwnerName);

public record UpdateContractSettingsRequest(
    decimal DefaultRetainagePercent,
    bool RequireSignedSubcontractBeforePayApp,
    string ApprovalWorkflowType,
    string AiaArchitectName,
    string AiaOwnerName);
