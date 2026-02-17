using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.SystemAdmin.Services;

namespace Pitbull.Api.Controllers;

/// <summary>
/// System health dashboard — database status, entity counts, system metrics.
/// </summary>
[ApiController]
[Route("api/admin/system-health")]
[Authorize(Roles = "Admin")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Admin - System Health")]
public class AdminSystemHealthController(ISystemHealthService healthService) : ControllerBase
{
    /// <summary>
    /// Get overall system health including database connectivity and entity stats
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(SystemHealthDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetHealth()
    {
        var result = await healthService.GetHealthAsync();
        return Ok(result.Value);
    }
}
