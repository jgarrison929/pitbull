using Microsoft.EntityFrameworkCore;
using Pitbull.Api.Infrastructure;
using Pitbull.Core.Constants;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Services;

/// <summary>
/// Shared JWT permission claim resolution for Auth + company-switch token reissue.
/// Demo users never receive <c>*</c> solely because they are demo — only true admins do.
/// </summary>
public static class RbacJwtPermissionResolver
{
    /// <summary>
    /// Maps title + identity roles to a non-Admin RBAC template for demo fallback.
    /// </summary>
    public static string ResolveDemoTemplateName(string? title, IEnumerable<string>? identityRoles)
    {
        var profile = RoleProfileResolver.Detect(title, identityRoles);
        return profile switch
        {
            TourProfile.Executive => PermissionConstants.RoleTemplates.Executive,
            TourProfile.Cfo => PermissionConstants.RoleTemplates.Controller,
            TourProfile.Clerk => PermissionConstants.RoleTemplates.Controller,
            TourProfile.ProjectManager => PermissionConstants.RoleTemplates.ProjectManager,
            TourProfile.ContractAdministrator => PermissionConstants.RoleTemplates.ProjectManager,
            TourProfile.Field => PermissionConstants.RoleTemplates.Foreman,
            TourProfile.Estimator => PermissionConstants.RoleTemplates.Estimator,
            TourProfile.Hr => PermissionConstants.RoleTemplates.PayrollSpecialist,
            // Never Admin: demo IT personas stay least-privilege for permission policies.
            TourProfile.ItAdmin => PermissionConstants.RoleTemplates.Viewer,
            _ => PermissionConstants.RoleTemplates.Viewer,
        };
    }

    /// <summary>
    /// Resolves permission claim values for JWT. Uses IgnoreQueryFilters (login/switch often pre-tenant).
    /// </summary>
    public static async Task<string[]> ResolveAsync(
        PitbullDbContext db,
        AppUser user,
        IList<string> identityRoles,
        CancellationToken ct = default)
    {
        // Login/refresh often run before TenantMiddleware. Bind RLS session var when we know the user tenant
        // so permission joins work even if rbac_* tables later gain FORCE RLS.
        if (user.TenantId != Guid.Empty && db.Database.IsRelational())
        {
            try
            {
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"SELECT set_config('app.current_tenant', {user.TenantId.ToString()}, false)", ct);
            }
            catch
            {
                // In-memory / test providers may not support set_config.
            }
        }

        var adminRoleId = await db.RbacRoles
            .AsNoTracking()
            .IgnoreQueryFilters()
            .Where(r => r.TenantId == user.TenantId && r.Name == PermissionConstants.RoleTemplates.Admin)
            .Select(r => r.Id)
            .FirstOrDefaultAsync(ct);

        var isRbacAdmin = adminRoleId != Guid.Empty
            && await db.UserRolesMap
                .AsNoTracking()
                .IgnoreQueryFilters()
                .AnyAsync(ur => ur.UserId == user.Id && ur.TenantId == user.TenantId && ur.RoleId == adminRoleId, ct);

        if (!isRbacAdmin)
            isRbacAdmin = identityRoles.Contains(RoleSeeder.Roles.Admin)
                || identityRoles.Any(r => r.EndsWith($":{RoleSeeder.Roles.Admin}", StringComparison.Ordinal));

        // Real admins keep wildcard. Demo users never get * solely for being demo —
        // DemoRestrictionMiddleware remains a write boundary, not a substitute for RBAC.
        if (isRbacAdmin && !user.IsDemoUser)
            return [PermissionConstants.Wildcard];

        var fromRoles = await db.RolePermissions
            .AsNoTracking()
            .IgnoreQueryFilters()
            .Where(rp => rp.TenantId == user.TenantId
                && db.UserRolesMap
                    .IgnoreQueryFilters()
                    .Any(ur => ur.UserId == user.Id && ur.TenantId == user.TenantId && ur.RoleId == rp.RoleId))
            .Join(
                db.Permissions.AsNoTracking().IgnoreQueryFilters(),
                rp => rp.PermissionId,
                p => p.Id,
                (rp, p) => p.Name)
            .Distinct()
            .OrderBy(n => n)
            .ToArrayAsync(ct);

        if (fromRoles.Length > 0)
        {
            // Strip accidental wildcard from demo RBAC Admin assignment if seed mis-linked.
            if (user.IsDemoUser)
                return fromRoles.Where(p => p != PermissionConstants.Wildcard).ToArray();
            return fromRoles;
        }

        if (!user.IsDemoUser)
            return [];

        // Self-service demo-register may lack UserRolesMap; map persona → template permissions.
        var template = ResolveDemoTemplateName(user.Title, identityRoles);
        if (template == PermissionConstants.RoleTemplates.Admin)
            template = PermissionConstants.RoleTemplates.Viewer;

        return await db.RolePermissions
            .AsNoTracking()
            .IgnoreQueryFilters()
            .Where(rp => rp.TenantId == user.TenantId
                && db.RbacRoles.IgnoreQueryFilters()
                    .Any(r => r.Id == rp.RoleId
                        && r.TenantId == user.TenantId
                        && r.Name == template))
            .Join(
                db.Permissions.AsNoTracking().IgnoreQueryFilters(),
                rp => rp.PermissionId,
                p => p.Id,
                (rp, p) => p.Name)
            .Distinct()
            .OrderBy(n => n)
            .ToArrayAsync(ct);
    }
}
