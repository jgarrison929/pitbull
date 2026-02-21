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
[Tags("Dashboard")]
public class DashboardPreferencesController(IDashboardPreferencesService preferencesService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetPreferences(CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
            return Unauthorized(new { error = "User not authenticated", code = "UNAUTHORIZED" });

        var pref = await preferencesService.GetPreferencesAsync(userId.Value, ct);
        return Ok(pref);
    }

    [HttpPut]
    public async Task<IActionResult> SetPreferences([FromBody] SetDashboardPreferenceRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
            return Unauthorized(new { error = "User not authenticated", code = "UNAUTHORIZED" });

        if (string.IsNullOrWhiteSpace(request.Layout))
            return BadRequest(new { error = "Layout is required", code = "VALIDATION_ERROR" });

        try
        {
            var result = await preferencesService.SavePreferencesAsync(userId.Value, request.Layout, ct);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message, code = "VALIDATION_ERROR" });
        }
    }

    [HttpPut("widgets")]
    public async Task<IActionResult> SetWidgetConfiguration([FromBody] SetWidgetConfigurationRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
            return Unauthorized(new { error = "User not authenticated", code = "UNAUTHORIZED" });

        if (request.Widgets is null || request.Widgets.Count == 0)
            return BadRequest(new { error = "At least one widget is required", code = "VALIDATION_ERROR" });

        var result = await preferencesService.SaveWidgetConfigurationAsync(userId.Value, request.Widgets, ct);
        return Ok(result);
    }

    [HttpGet("/api/dashboard/templates/{role}")]
    public IActionResult GetTemplate(string role)
    {
        var template = preferencesService.GetTemplate(role);
        return Ok(template);
    }

    [HttpPost("reset")]
    public async Task<IActionResult> ResetToDefault(CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
            return Unauthorized(new { error = "User not authenticated", code = "UNAUTHORIZED" });

        var result = await preferencesService.ResetToDefaultAsync(userId.Value, ct);
        return Ok(result);
    }

    private Guid? GetUserId()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
            return null;
        return userId;
    }
}
