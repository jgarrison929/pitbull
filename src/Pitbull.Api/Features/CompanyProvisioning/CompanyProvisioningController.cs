using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Pitbull.Api.Features.CompanyProvisioning;

/// <summary>
/// Admin endpoints for provisioning new companies with chart of accounts templates.
/// </summary>
[ApiController]
[Route("api/admin/company-provisioning")]
[Authorize(Policy = "Admin.Companies")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Admin - Company Provisioning")]
public class CompanyProvisioningController(
    ICompanyProvisioningService provisioningService) : ControllerBase
{
    /// <summary>
    /// List available chart of accounts templates.
    /// Returns template keys, display names, and descriptions for the template selector dropdown.
    /// </summary>
    [HttpGet("templates")]
    [ProducesResponseType(typeof(List<TemplateInfo>), StatusCodes.Status200OK)]
    public IActionResult GetTemplates()
    {
        return Ok(ChartOfAccountsTemplates.GetTemplateList());
    }

    /// <summary>
    /// Provision a new company with a chart of accounts template, accounting periods,
    /// and initial user access.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(CompanyProvisioningResult), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Provision(
        [FromBody] CompanyProvisioningRequest request,
        CancellationToken ct)
    {
        // Auto-populate admin user ID from the current user if not specified
        if (!request.AdminUserId.HasValue)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (Guid.TryParse(userIdClaim, out var userId))
            {
                request = request with { AdminUserId = userId };
            }
        }

        try
        {
            var result = await provisioningService.ProvisionAsync(request, ct);
            return Created($"/api/admin/companies/{result.CompanyId}", result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
    }
}
