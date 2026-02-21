using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Core.MultiTenancy;

/// <summary>
/// Resolves company context from X-Company-Id header, JWT claim, or user's default company.
/// Runs AFTER TenantMiddleware. Sets PostgreSQL session variable for company-level RLS.
/// </summary>
public class CompanyMiddleware(RequestDelegate next, ILogger<CompanyMiddleware> logger)
{
    private const string CompanyHeader = "X-Company-Id";
    private const string CompanyClaimType = "company_id";
    private const string CompanyIdsClaimType = "company_ids";

    public async Task InvokeAsync(HttpContext context, CompanyContext companyContext, PitbullDbContext db, ITenantContext tenantContext)
    {
        // Only resolve company if tenant is resolved
        if (!tenantContext.IsResolved)
        {
            await next(context);
            return;
        }

        // Load user's accessible companies
        var userId = GetUserId(context);
        if (userId.HasValue)
        {
            var accessibleCompanyIds = await db.UserCompanyAccess
                .IgnoreQueryFilters()
                .Where(uca => uca.TenantId == tenantContext.TenantId
                              && uca.UserId == userId.Value
                              && !uca.IsDeleted)
                .Select(uca => uca.CompanyId)
                .ToListAsync();

            // If user has no company access entries, give them access to all tenant companies
            // (backward compatibility for existing users before multi-company was set up).
            // TODO: Remove this fallback once all tenants have explicit UserCompanyAccess records.
            if (accessibleCompanyIds.Count == 0)
            {
                accessibleCompanyIds = await db.Companies
                    .IgnoreQueryFilters()
                    .Where(c => c.TenantId == tenantContext.TenantId && !c.IsDeleted && c.IsActive)
                    .Select(c => c.Id)
                    .ToListAsync();

                if (accessibleCompanyIds.Count > 0)
                {
                    logger.LogWarning(
                        "User {UserId} has no explicit company access — falling back to all {Count} tenant companies. " +
                        "Grant explicit UserCompanyAccess to resolve this.",
                        userId, accessibleCompanyIds.Count);
                }
            }

            companyContext.SetAccessibleCompanies(accessibleCompanyIds);
        }

        // Resolve active company (validates against accessible companies with fallback)
        var companyId = ResolveCompanyId(context, companyContext);
        if (companyId.HasValue)
        {
            // Query must include IsActive check (P2: block inactive companies)
            var company = await db.Companies
                .IgnoreQueryFilters()
                .Where(c => c.Id == companyId.Value
                            && c.TenantId == tenantContext.TenantId
                            && !c.IsDeleted
                            && c.IsActive)
                .Select(c => new { c.Id, c.Code, c.Name })
                .FirstOrDefaultAsync();

            if (company != null)
            {
                companyContext.CompanyId = company.Id;
                companyContext.CompanyCode = company.Code;
                companyContext.CompanyName = company.Name;

                // Set PostgreSQL session variable for company-level RLS
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"SELECT set_config('app.current_company', {company.Id.ToString()}, false);");

                logger.LogDebug("Company resolved: {CompanyId} ({CompanyCode})", company.Id, company.Code);
            }
            else
            {
                logger.LogWarning("Company {CompanyId} not found, inactive, or not in tenant", companyId.Value);
            }
        }

        await next(context);
    }

    private static Guid? ResolveCompanyId(HttpContext context, CompanyContext companyContext)
    {
        var accessibleIds = companyContext.AccessibleCompanyIds;
        var hasAccessList = accessibleIds.Count > 0;

        // Helper to check if a company ID is accessible
        bool IsAccessible(Guid id) => !hasAccessList || accessibleIds.Contains(id);

        // 1. Try X-Company-Id header (explicit per-request override)
        // P1 fix: Only accept if user has access, otherwise fall through to next option
        if (context.Request.Headers.TryGetValue(CompanyHeader, out var headerValue)
            && Guid.TryParse(headerValue, out var fromHeader)
            && IsAccessible(fromHeader))
        {
            return fromHeader;
        }

        // 2. Try JWT claim (session default)
        // P1 fix: Only accept if user has access, otherwise fall through
        var claimValue = context.User?.FindFirstValue(CompanyClaimType);
        if (Guid.TryParse(claimValue, out var fromClaim) && IsAccessible(fromClaim))
        {
            return fromClaim;
        }

        // 3. Fall back to first accessible company
        if (hasAccessList)
        {
            return accessibleIds[0];
        }

        return null;
    }

    private static Guid? GetUserId(HttpContext context)
    {
        var userId = context.User?.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? context.User?.FindFirstValue("sub");
        return Guid.TryParse(userId, out var id) ? id : null;
    }
}
