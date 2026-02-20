using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Services;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/dashboard/preferences")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
public class DashboardPreferencesController(IDashboardPreferencesService preferencesService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetPreferences(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(new { error = "User not authenticated", code = "UNAUTHORIZED" });

        var pref = await preferencesService.GetLayoutAsync(userId, ct);
        return Ok(pref);
    }

    [HttpPut]
    public async Task<IActionResult> SetPreferences([FromBody] SetDashboardPreferenceRequest request, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(new { error = "User not authenticated", code = "UNAUTHORIZED" });

        if (string.IsNullOrWhiteSpace(request.Layout))
            return BadRequest(new { error = "Layout is required", code = "VALIDATION_ERROR" });

        try
        {
            await preferencesService.SetLayoutAsync(userId, request.Layout, ct);
            return Ok(new DashboardPreferenceDto(request.Layout));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message, code = "VALIDATION_ERROR" });
        }
    }
}
