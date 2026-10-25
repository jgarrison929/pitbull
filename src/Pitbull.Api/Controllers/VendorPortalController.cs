using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Billing.Services;
using Pitbull.Core.Logging;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/vendor-portal")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Vendor Portal")]
public class VendorPortalController(
    IVendorPortalService portalService,
    ILogger<VendorPortalController> logger) : ControllerBase
{
    private const string PortalAuthError = "Invalid or expired link. Please contact your general contractor for a new link.";
    private const string PortalAuthErrorCode = "PORTAL_AUTH_FAILED";

    // --- Admin endpoints (Authorized) ---

    [HttpPost("tokens")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> GenerateToken([FromBody] GenerateTokenRequest request, CancellationToken ct)
    {
        // Early clamp (service also enforces 1..90) so garbage values never hit DB.
        var days = Math.Clamp(request.ExpirationDays, 1, 90);
        var result = await portalService.GenerateTokenAsync(request.VendorId, request.ProjectId, days, ct);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });
        return Ok(result.Value);
    }

    [HttpGet("tokens")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> GetTokensForVendor([FromQuery] Guid vendorId, CancellationToken ct)
    {
        var result = await portalService.GetTokensForVendorAsync(vendorId, ct);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });
        return Ok(result.Value);
    }

    [HttpDelete("tokens/{id:guid}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> RevokeToken(Guid id, CancellationToken ct)
    {
        var result = await portalService.RevokeTokenAsync(id, ct);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });
        return NoContent();
    }

    // --- Public endpoints (AllowAnonymous, stricter rate limit) ---
    // These return a generic error message to avoid leaking token state (valid/revoked/expired).

    [HttpGet("{token}/validate")]
    [AllowAnonymous]
    [EnableRateLimiting("portal")]
    public async Task<IActionResult> ValidateToken(string token, CancellationToken ct)
    {
        if (!IsPlausiblePortalToken(token))
            return Unauthorized(new { error = PortalAuthError, code = PortalAuthErrorCode });

        var result = await portalService.ValidateTokenAsync(token, ct);
        if (!result.IsSuccess)
        {
            logger.LogWarning("Portal token validation failed: {ErrorCode}", LogSafe.Text(result.ErrorCode));
            return Unauthorized(new { error = PortalAuthError, code = PortalAuthErrorCode });
        }
        return Ok(result.Value);
    }

    [HttpGet("{token}/lien-waivers")]
    [AllowAnonymous]
    [EnableRateLimiting("portal")]
    public async Task<IActionResult> GetLienWaivers(string token, CancellationToken ct)
    {
        if (!IsPlausiblePortalToken(token))
            return Unauthorized(new { error = PortalAuthError, code = PortalAuthErrorCode });

        var result = await portalService.GetLienWaiversAsync(token, ct);
        if (!result.IsSuccess)
        {
            logger.LogWarning("Portal lien waivers access failed: {ErrorCode}", LogSafe.Text(result.ErrorCode));
            return Unauthorized(new { error = PortalAuthError, code = PortalAuthErrorCode });
        }
        return Ok(result.Value);
    }

    [HttpPost("{token}/lien-waivers")]
    [AllowAnonymous]
    [EnableRateLimiting("portal")]
    public async Task<IActionResult> SubmitLienWaiver(string token, [FromBody] SubmitLienWaiverDto dto, CancellationToken ct)
    {
        if (!IsPlausiblePortalToken(token))
            return Unauthorized(new { error = PortalAuthError, code = PortalAuthErrorCode });

        // Public endpoint: bound untrusted body fields before service work.
        if (dto.Amount is <= 0 or > 999_999_999.99m)
            return BadRequest(new { error = "Amount must be between 0.01 and 999,999,999.99", code = "VALIDATION_ERROR" });
        if (dto.Description is { Length: > 2000 })
            return BadRequest(new { error = "Description cannot exceed 2000 characters", code = "VALIDATION_ERROR" });
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (dto.ThroughDate < today.AddYears(-10) || dto.ThroughDate > today.AddYears(2))
            return BadRequest(new { error = "ThroughDate is out of allowed range", code = "VALIDATION_ERROR" });

        var result = await portalService.SubmitLienWaiverAsync(token, dto, ct);
        if (!result.IsSuccess)
        {
            if (result.ErrorCode is "INVALID_TOKEN" or "TOKEN_REVOKED" or "TOKEN_EXPIRED")
            {
                logger.LogWarning("Portal lien waiver submission auth failed: {ErrorCode}", LogSafe.Text(result.ErrorCode));
                return Unauthorized(new { error = PortalAuthError, code = PortalAuthErrorCode });
            }
            return BadRequest(new { error = result.Error, code = result.ErrorCode });
        }
        return Ok(result.Value);
    }

    [HttpGet("{token}/payments")]
    [AllowAnonymous]
    [EnableRateLimiting("portal")]
    public async Task<IActionResult> GetPaymentHistory(string token, CancellationToken ct)
    {
        if (!IsPlausiblePortalToken(token))
            return Unauthorized(new { error = PortalAuthError, code = PortalAuthErrorCode });

        var result = await portalService.GetPaymentHistoryAsync(token, ct);
        if (!result.IsSuccess)
        {
            logger.LogWarning("Portal payment history access failed: {ErrorCode}", LogSafe.Text(result.ErrorCode));
            return Unauthorized(new { error = PortalAuthError, code = PortalAuthErrorCode });
        }
        return Ok(result.Value);
    }

    /// <summary>
    /// Portal tokens are URL-safe base64 (~43+ chars). Reject empty/tiny/huge strings before DB work.
    /// </summary>
    private static bool IsPlausiblePortalToken(string? token) =>
        !string.IsNullOrWhiteSpace(token) &&
        token.Length is >= 20 and <= 256;
}

public record GenerateTokenRequest(Guid VendorId, Guid ProjectId, int ExpirationDays = 90);
