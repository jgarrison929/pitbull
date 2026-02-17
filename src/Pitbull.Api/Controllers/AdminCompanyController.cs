using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.SystemAdmin.Services;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Admin tenant settings management — persisted to database.
/// </summary>
[ApiController]
[Route("api/admin/company")]
[Authorize(Roles = "Admin")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Admin - Tenant Settings")]
public class AdminCompanyController(ITenantSettingsService settingsService) : ControllerBase
{
    /// <summary>
    /// Get tenant settings (returns defaults if not configured yet)
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(TenantSettingsDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSettings()
    {
        var result = await settingsService.GetSettingsAsync();
        return Ok(result.Value);
    }

    /// <summary>
    /// Create or update tenant settings
    /// </summary>
    [HttpPut]
    [ProducesResponseType(typeof(TenantSettingsDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateSettings([FromBody] UpsertTenantSettingsCommand command)
    {
        var result = await settingsService.UpsertSettingsAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }
}
