using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.Data;

namespace Pitbull.Core.MultiTenancy;

/// <summary>
/// Resolves tenant from JWT claims, subdomain, or header.
/// Sets PostgreSQL session variable for Row-Level Security.
/// </summary>
public class TenantMiddleware(RequestDelegate next, ILogger<TenantMiddleware> logger)
{
    private const string TenantHeader = "X-Tenant-Id";
    private const string TenantClaimType = "tenant_id";

    public async Task InvokeAsync(HttpContext context, TenantContext tenantContext, PitbullDbContext db)
    {
        var tenantId = ResolveTenantId(context);

        if (tenantId.HasValue)
        {
            tenantContext.TenantId = tenantId.Value;

            // Set PostgreSQL session variable for RLS.
            // NOTE: Using set_config() avoids issues with parameterizing SET statements.
            // The tenant ID must be converted to string since set_config() requires text parameters.
            var tenantIdString = tenantId.Value.ToString();
            await db.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT set_config('app.current_tenant', {tenantIdString}, false);");

            logger.LogDebug("Tenant resolved: {TenantId}", tenantId.Value);
        }

        await next(context);
    }

    private static Guid? ResolveTenantId(HttpContext context)
    {
        // 1. Try JWT claim (preferred)
        var claimValue = context.User?.FindFirstValue(TenantClaimType);
        if (Guid.TryParse(claimValue, out var fromClaim))
            return fromClaim;

        // 2. Try header (API integrations)
        if (context.Request.Headers.TryGetValue(TenantHeader, out var headerValue)
            && Guid.TryParse(headerValue, out var fromHeader))
            return fromHeader;

        // 3. Try subdomain (acme.pitbull.local)
        var host = context.Request.Host.Host;
        var parts = host.Split('.');
        if (parts.Length >= 3)
        {
            // Would look up tenant by slug here
            // For now, return null - will implement with tenant service
        }

        return null;
    }
}
