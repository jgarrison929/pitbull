using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Infrastructure;

/// <summary>
/// Seeds system roles on application startup.
/// Creates tenant-scoped roles for each tenant that doesn't have them.
/// </summary>
public sealed class RoleSeeder(
    RoleManager<AppRole> roleManager,
    UserManager<AppUser> userManager,
    PitbullDbContext db,
    ILogger<RoleSeeder> logger)
{
    /// <summary>
    /// Standard role names used throughout the application.
    /// </summary>
    public static class Roles
    {
        public const string Admin = "Admin";
        public const string Manager = "Manager";
        public const string Supervisor = "Supervisor";
        public const string Viewer = "Viewer";
        public const string User = "User";

        public static readonly string[] All = [Admin, Manager, Supervisor, Viewer, User];

        public static readonly Dictionary<string, string> Descriptions = new()
        {
            [Admin] = "Full system access. Can manage users, roles, and all settings.",
            [Manager] = "Can manage projects, employees, and approve time entries.",
            [Supervisor] = "Can view and manage assigned team members and projects.",
            [Viewer] = "Read-only access. Can view dashboard and profile without edit permissions.",
            [User] = "Standard user. Can track time and view assigned projects."
        };
    }

    /// <summary>
    /// Ensures all system roles exist for a given tenant.
    /// Should be called during tenant creation or on startup.
    /// </summary>
    public async Task EnsureRolesForTenantAsync(Guid tenantId, CancellationToken ct = default)
    {
        foreach (var roleName in Roles.All)
        {
            var tenantRoleName = $"{tenantId}:{roleName}";
            if (await TenantRoleExistsAsync(tenantId, tenantRoleName, ct))
                continue;

            var role = new AppRole
            {
                Id = Guid.NewGuid(),
                Name = tenantRoleName,
                NormalizedName = tenantRoleName.ToUpperInvariant(),
                TenantId = tenantId,
                Description = Roles.Descriptions.GetValueOrDefault(roleName),
                IsSystemRole = true
            };

            var result = await roleManager.CreateAsync(role);
            if (result.Succeeded)
            {
                logger.LogInformation("Created role {RoleName} for tenant {TenantId}", roleName, tenantId);
            }
            else if (IsDuplicateRoleResult(result))
            {
                logger.LogDebug("Role {RoleName} already exists for tenant {TenantId}", roleName, tenantId);
            }
            else
            {
                var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                logger.LogWarning("Failed to create role {RoleName}: {Errors}", roleName, errors);
            }
        }
    }

    private async Task<bool> TenantRoleExistsAsync(Guid tenantId, string tenantRoleName, CancellationToken ct)
    {
        return await db.Set<AppRole>()
            .IgnoreQueryFilters()
            .AnyAsync(r => r.TenantId == tenantId && r.Name == tenantRoleName, ct);
    }

    private static bool IsDuplicateRoleResult(IdentityResult result) =>
        result.Errors.All(e =>
            e.Code == "DuplicateRoleName" ||
            (e.Description?.Contains("already taken", StringComparison.OrdinalIgnoreCase) ?? false));

    /// <summary>
    /// Assigns a role to a user within their tenant context.
    /// </summary>
    public async Task AssignRoleToUserAsync(AppUser user, string roleName, CancellationToken ct = default)
    {
        var tenantRoleName = $"{user.TenantId}:{roleName}";

        if (await userManager.IsInRoleAsync(user, tenantRoleName))
        {
            logger.LogDebug("User {UserId} already has role {RoleName}", user.Id, roleName);
            return;
        }

        var result = await userManager.AddToRoleAsync(user, tenantRoleName);
        if (result.Succeeded)
        {
            logger.LogInformation("Assigned role {RoleName} to user {UserId} ({Email})",
                roleName, user.Id, user.Email);
        }
        else
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            logger.LogWarning("Failed to assign role {RoleName} to user {UserId}: {Errors}",
                roleName, user.Id, errors);
        }
    }

    /// <summary>
    /// Gets the logical role names (without tenant prefix) for a user.
    /// </summary>
    public async Task<IList<string>> GetUserRolesAsync(AppUser user)
    {
        var roles = await userManager.GetRolesAsync(user);
        var prefix = $"{user.TenantId}:";

        return roles
            .Where(r => r.StartsWith(prefix))
            .Select(r => r[prefix.Length..])
            .ToList();
    }

    /// <summary>
    /// Checks if user has a specific role within their tenant.
    /// </summary>
    public async Task<bool> UserHasRoleAsync(AppUser user, string roleName)
    {
        var tenantRoleName = $"{user.TenantId}:{roleName}";
        return await userManager.IsInRoleAsync(user, tenantRoleName);
    }

    /// <summary>
    /// Makes the first user in a tenant an Admin if no Admin exists.
    /// Call this after creating a new user.
    /// </summary>
    public async Task EnsureTenantHasAdminAsync(Guid tenantId, CancellationToken ct = default)
    {
        // First ensure roles exist
        await EnsureRolesForTenantAsync(tenantId, ct);

        var adminRoleName = $"{tenantId}:{Roles.Admin}";
        var adminRole = await db.Set<AppRole>()
            .FirstOrDefaultAsync(r => r.Name == adminRoleName, ct);

        if (adminRole is null)
        {
            logger.LogWarning("Admin role not found for tenant {TenantId}", tenantId);
            return;
        }

        // Check if any user already has Admin role
        var adminUsers = await userManager.GetUsersInRoleAsync(adminRoleName);
        if (adminUsers.Count > 0)
        {
            logger.LogDebug("Tenant {TenantId} already has {Count} admin(s)", tenantId, adminUsers.Count);
            return;
        }

        // Get the first user in the tenant (by creation date)
        var firstUser = await db.Set<AppUser>()
            .Where(u => u.TenantId == tenantId)
            .OrderBy(u => u.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (firstUser is null)
        {
            logger.LogDebug("No users found in tenant {TenantId} to promote to admin", tenantId);
            return;
        }

        await AssignRoleToUserAsync(firstUser, Roles.Admin, ct);
        logger.LogInformation("Auto-promoted first user {UserId} ({Email}) to Admin for tenant {TenantId}",
            firstUser.Id, firstUser.Email, tenantId);
    }

    /// <summary>
    /// Ensures a specific email is assigned to the tenant's Admin role.
    /// Safe to run multiple times.
    /// </summary>
    public async Task EnsureAdminForEmailAsync(string email, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(email))
            return;

        string normalizedEmail = email.Trim().ToLowerInvariant();

        AppUser? user = await db.Set<AppUser>()
            .FirstOrDefaultAsync(u => u.Email != null && u.Email.ToLower() == normalizedEmail, ct);

        if (user is null)
        {
            logger.LogInformation("Admin seed skipped: user {Email} not found", email);
            return;
        }

        await EnsureRolesForTenantAsync(user.TenantId, ct);
        await AssignRoleToUserAsync(user, Roles.Admin, ct);

        logger.LogInformation(
            "Admin seed ensured role {RoleName} for user {UserId} ({Email}) in tenant {TenantId}",
            Roles.Admin, user.Id, user.Email, user.TenantId);
    }
}
