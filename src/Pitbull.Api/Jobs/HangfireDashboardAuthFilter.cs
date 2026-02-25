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

        return httpContext.User.IsInRole("SystemAdmin");
    }
}
