using Hangfire.Dashboard;
using Microsoft.AspNetCore.Http;

namespace Pitbull.Api.Jobs;

/// <summary>
/// Restricts Hangfire dashboard access to platform-level SystemAdmin users only.
///
/// The /hangfire dashboard is a platform surface — it shows jobs across ALL tenants.
/// Tenant-level Admin users must NOT have access (cross-tenant data exposure).
/// Only SystemAdmin (platform operators) should see this dashboard.
/// </summary>
public sealed class HangfireDashboardAuthFilter : IDashboardAuthorizationFilter
{
    public bool Authorize(DashboardContext context)
    {
        var httpContext = ((AspNetCoreDashboardContext)context).HttpContext;
        if (httpContext.User.Identity?.IsAuthenticated != true)
            return false;

        // Defense in depth: demo principals never reach Hangfire even if a role claim is wrong.
        if (string.Equals(httpContext.User.FindFirst("is_demo_user")?.Value, "true", StringComparison.Ordinal)
            || IsDemoEmail(httpContext.User))
            return false;

        return httpContext.User.IsInRole("SystemAdmin");
    }

    private static bool IsDemoEmail(System.Security.Claims.ClaimsPrincipal user)
    {
        var email = user.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
            ?? user.FindFirst("email")?.Value;
        if (string.IsNullOrWhiteSpace(email))
            return false;
        return email.EndsWith("@demo.local", StringComparison.OrdinalIgnoreCase)
            || email.Equals("demo@example.com", StringComparison.OrdinalIgnoreCase);
    }
}
