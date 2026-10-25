using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Http;

namespace Pitbull.Api.Configuration;

/// <summary>
/// Auth and generic API rate-limit partitions.
/// Named <c>AddFixedWindowLimiter</c> policies use a single global partition (policy name only),
/// which lets one client exhaust the budget for everyone. Prefer IP/user partitions.
/// </summary>
public static class AuthRateLimitPolicy
{
    public static string ClientIpKey(HttpContext context) =>
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    /// <summary>
    /// Authenticated user id when present; otherwise client IP (anonymous endpoints).
    /// </summary>
    public static string AuthenticatedOrIpKey(HttpContext context) =>
        context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
        ?? context.User.FindFirst("sub")?.Value
        ?? ClientIpKey(context);

    public static FixedWindowRateLimiterOptions WindowOptions(
        int permitLimit,
        TimeSpan window,
        int queueLimit = 0) =>
        new()
        {
            PermitLimit = permitLimit,
            Window = window,
            QueueLimit = queueLimit,
        };
}
