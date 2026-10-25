using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Services;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/notification-preferences")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Notification Preferences")]
public class NotificationPreferencesController(
    INotificationPreferenceService notificationPreferenceService,
    ITenantContext tenantContext,
    ILogger<NotificationPreferencesController> logger) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<NotificationPreferenceDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPreferences(CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized();

        var tenantId = tenantContext.TenantId;
        if (tenantId == Guid.Empty)
            return Unauthorized();

        var preferences = await notificationPreferenceService.GetPreferencesAsync(userId.Value, tenantId, ct);
        return Ok(preferences);
    }

    [HttpPut]
    [ProducesResponseType(typeof(IReadOnlyList<NotificationPreferenceDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdatePreferences([FromBody] NotificationPreferenceBulkUpdateRequest request, CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized();

        var tenantId = tenantContext.TenantId;
        if (tenantId == Guid.Empty)
            return Unauthorized();

        try
        {
            var result = await notificationPreferenceService.UpdatePreferencesAsync(userId.Value, tenantId, request.Preferences, ct);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            logger.LogWarning(ex, "Notification preference update failed");
            return BadRequest(new { error = "Invalid notification preference request", code = "VALIDATION_ERROR" });
        }
    }

    [HttpGet("digest")]
    [ProducesResponseType(typeof(EmailDigestSettingDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDigest(CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized();

        var tenantId = tenantContext.TenantId;
        if (tenantId == Guid.Empty)
            return Unauthorized();

        var result = await notificationPreferenceService.GetDigestAsync(userId.Value, tenantId, ct);
        return Ok(result);
    }

    [HttpPut("digest")]
    [ProducesResponseType(typeof(EmailDigestSettingDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateDigest([FromBody] EmailDigestSettingUpdateDto request, CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized();

        var tenantId = tenantContext.TenantId;
        if (tenantId == Guid.Empty)
            return Unauthorized();

        try
        {
            var result = await notificationPreferenceService.UpdateDigestAsync(userId.Value, tenantId, request, ct);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            logger.LogWarning(ex, "Notification preference update failed");
            return BadRequest(new { error = "Invalid notification preference request", code = "VALIDATION_ERROR" });
        }
    }

    private Guid? GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("sub");
        return claim is not null && Guid.TryParse(claim.Value, out var userId)
            ? userId
            : null;
    }
}

public sealed record NotificationPreferenceBulkUpdateRequest(
    IReadOnlyList<NotificationPreferenceUpdateDto> Preferences);
