using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.Data;
using Pitbull.Core.Logging;

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
        var tenantId = ResolveTenantId(context, out var headerMismatch);

        if (headerMismatch)
        {
            logger.LogWarning(
                "Authenticated request to {Path} rejected: X-Tenant-Id does not match JWT tenant_id",
                RequestLogSanitizer.SanitizeRequestPathForLogging(context.Request.Path.Value));
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new { error = "Tenant header does not match authenticated tenant." });
            return;
        }

        if (tenantId.HasValue)
        {
            tenantContext.TenantId = tenantId.Value;

            // Set PostgreSQL session variable for RLS.
            // NOTE: Using set_config() avoids issues with parameterizing SET statements.
            await db.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT set_config('app.current_tenant', {tenantId.Value.ToString()}, false);");

            logger.LogDebug("Tenant resolved: {TenantId}", tenantId.Value);
        }
        else if (context.User?.Identity?.IsAuthenticated == true
                 && context.Request.Path.StartsWithSegments("/api"))
        {
            // Authenticated API requests MUST have tenant_id on the principal.
            // X-Tenant-Id is ignored for authenticated users (cannot supply or override).
            logger.LogWarning(
                "Authenticated request to {Path} with no tenant claim",
                RequestLogSanitizer.SanitizeRequestPathForLogging(context.Request.Path.Value));
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new { error = "Tenant context could not be resolved." });
            return;
        }

        await next(context);
    }

    /// <summary>
    /// Authenticated principals: tenant_id JWT claim only (header cannot supply or override).
    /// Unauthenticated: X-Tenant-Id allowed for anonymous/integration paths that still set RLS.
    /// </summary>
    private static Guid? ResolveTenantId(HttpContext context, out bool headerMismatch)
    {
        headerMismatch = false;
        var isAuthenticated = context.User?.Identity?.IsAuthenticated == true;

        Guid? fromClaim = null;
        var claimValue = context.User?.FindFirstValue(TenantClaimType);
        if (Guid.TryParse(claimValue, out var claimGuid))
            fromClaim = claimGuid;

        Guid? fromHeader = null;
        if (context.Request.Headers.TryGetValue(TenantHeader, out var headerValue)
            && Guid.TryParse(headerValue, out var headerGuid))
            fromHeader = headerGuid;

        if (isAuthenticated)
        {
            if (fromClaim.HasValue)
            {
                // Reject forge attempts that disagree with the token.
                if (fromHeader.HasValue && fromHeader.Value != fromClaim.Value)
                    headerMismatch = true;
                return fromClaim;
            }

            // Do not fall back to X-Tenant-Id for authenticated principals without tenant_id.
            return null;
        }

        // Anonymous: header allowed (vendor portal / invitation paths bind their own tenant separately).
        if (fromHeader.HasValue)
            return fromHeader;

        // Subdomain lookup reserved for multi-tenant host routing (not implemented).
        _ = context.Request.Host.Host;

        return null;
    }
}
