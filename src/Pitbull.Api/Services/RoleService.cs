using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.Entities;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Api.Services;

public interface IRoleService
{
    Task<IReadOnlyList<RoleListItemDto>> ListRolesAsync(CancellationToken ct = default);
    Task<RoleDetailDto?> GetRoleAsync(Guid roleId, CancellationToken ct = default);
    Task<RoleDetailDto> CreateRoleAsync(CreateRoleDto dto, CancellationToken ct = default);
    Task<RoleDetailDto?> UpdateRoleAsync(Guid roleId, UpdateRoleDto dto, CancellationToken ct = default);
    Task<bool> DeleteRoleAsync(Guid roleId, CancellationToken ct = default);
    Task<RoleDetailDto?> AssignPermissionsAsync(Guid roleId, IReadOnlyCollection<Guid> permissionIds, CancellationToken ct = default);
    Task<RoleDetailDto?> RemovePermissionsAsync(Guid roleId, IReadOnlyCollection<Guid> permissionIds, CancellationToken ct = default);
    Task<IReadOnlyList<PermissionCategoryDto>> ListPermissionsByCategoryAsync(CancellationToken ct = default);
    Task<bool> AssignUserRoleAsync(Guid userId, Guid roleId, CancellationToken ct = default);
    Task<bool> RemoveUserRoleAsync(Guid userId, Guid roleId, CancellationToken ct = default);
}

public sealed class RoleService(
    PitbullDbContext db,
    ITenantContext tenantContext) : IRoleService
{
    private static readonly PermissionSeed[] PermissionSeeds =
    [
        new("Projects.View", "Projects", "View projects"),
        new("Projects.Create", "Projects", "Create new projects"),
        new("Projects.Edit", "Projects", "Edit existing projects"),
        new("Projects.Delete", "Projects", "Delete projects"),

        new("TimeTracking.View", "TimeTracking", "View time entries"),
        new("TimeTracking.Create", "TimeTracking", "Create time entries"),
        new("TimeTracking.Approve", "TimeTracking", "Approve submitted time entries"),

        new("Admin.Users", "Admin", "Manage users"),
        new("Admin.Roles", "Admin", "Manage roles and permissions"),
        new("Admin.Settings", "Admin", "Manage tenant settings"),

        new("Reports.View", "Reports", "View reports"),
        new("Reports.Export", "Reports", "Export report data"),

        new("Bids.View", "Bids", "View bids"),
        new("Bids.Create", "Bids", "Create bids"),
        new("Bids.Edit", "Bids", "Edit bids"),

        new("Contracts.View", "Contracts", "View contracts"),
        new("Contracts.Create", "Contracts", "Create contracts"),
        new("Contracts.Edit", "Contracts", "Edit contracts"),

        new("Equipment.View", "Equipment", "View equipment"),
        new("Equipment.Manage", "Equipment", "Manage equipment")
    ];

    private static readonly RoleSeed[] RoleSeeds =
    [
        new("Admin", "Full system access", true, ["*"]),
        new("ProjectManager", "Project and reporting management", true,
            ["Projects.", "TimeTracking.", "Reports."]),
        new("Foreman", "Crew and daily time entry", true,
            ["TimeTracking.View", "TimeTracking.Create", "Projects.View"]),
        new("Viewer", "Read-only access", true,
            [".View"])
    ];

    public async Task<IReadOnlyList<RoleListItemDto>> ListRolesAsync(CancellationToken ct = default)
    {
        var tenantId = GetTenantId();
        await EnsureSeededAsync(tenantId, ct);

        var roles = await db.RbacRoles
            .AsNoTracking()
            .Where(r => r.TenantId == tenantId)
            .OrderBy(r => r.Name)
            .Select(r => new RoleListItemDto(
                r.Id,
                r.Name,
                r.Description,
                r.IsSystem,
                db.RolePermissions.Count(rp => rp.TenantId == tenantId && rp.RoleId == r.Id),
                db.UserRolesMap.Count(ur => ur.TenantId == tenantId && ur.RoleId == r.Id)
            ))
            .ToListAsync(ct);

        return roles;
    }

    public async Task<RoleDetailDto?> GetRoleAsync(Guid roleId, CancellationToken ct = default)
    {
        var tenantId = GetTenantId();
        await EnsureSeededAsync(tenantId, ct);

        var role = await db.RbacRoles
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.Id == roleId, ct);

        if (role is null)
            return null;

        var permissions = await db.RolePermissions
            .AsNoTracking()
            .Where(rp => rp.TenantId == tenantId && rp.RoleId == roleId)
            .Select(rp => new PermissionDto(
                rp.Permission.Id,
                rp.Permission.Name,
                rp.Permission.Category,
                rp.Permission.Description
            ))
            .OrderBy(p => p.Category)
            .ThenBy(p => p.Name)
            .ToListAsync(ct);

        var users = await db.UserRolesMap
            .AsNoTracking()
            .Where(ur => ur.TenantId == tenantId && ur.RoleId == roleId)
            .Join(
                db.Set<AppUser>().AsNoTracking(),
                ur => ur.UserId,
                u => u.Id,
                (ur, u) => new AssignedUserDto(u.Id, u.FullName, u.Email ?? string.Empty)
            )
            .OrderBy(u => u.FullName)
            .ToListAsync(ct);

        return new RoleDetailDto(
            role.Id,
            role.Name,
            role.Description,
            role.IsSystem,
            role.CreatedAt,
            role.UpdatedAt,
            permissions,
            users
        );
    }

    public async Task<RoleDetailDto> CreateRoleAsync(CreateRoleDto dto, CancellationToken ct = default)
    {
        var tenantId = GetTenantId();
        await EnsureSeededAsync(tenantId, ct);

        var normalizedName = dto.Name.Trim();
        var exists = await db.RbacRoles.AnyAsync(
            r => r.TenantId == tenantId && r.Name == normalizedName,
            ct);

        if (exists)
            throw new InvalidOperationException("A role with that name already exists.");

        var role = new Role
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = normalizedName,
            Description = dto.Description?.Trim(),
            IsSystem = false
        };

        db.RbacRoles.Add(role);
        await db.SaveChangesAsync(ct);

        return (await GetRoleAsync(role.Id, ct))!;
    }

    public async Task<RoleDetailDto?> UpdateRoleAsync(Guid roleId, UpdateRoleDto dto, CancellationToken ct = default)
    {
        var tenantId = GetTenantId();
        await EnsureSeededAsync(tenantId, ct);

        var role = await db.RbacRoles.FirstOrDefaultAsync(r => r.TenantId == tenantId && r.Id == roleId, ct);
        if (role is null)
            return null;

        if (role.IsSystem)
            throw new InvalidOperationException("System roles cannot be modified.");

        var normalizedName = dto.Name.Trim();
        var duplicate = await db.RbacRoles.AnyAsync(
            r => r.TenantId == tenantId && r.Name == normalizedName && r.Id != roleId,
            ct);

        if (duplicate)
            throw new InvalidOperationException("A role with that name already exists.");

        role.Name = normalizedName;
        role.Description = dto.Description?.Trim();
        role.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        return await GetRoleAsync(roleId, ct);
    }

    public async Task<bool> DeleteRoleAsync(Guid roleId, CancellationToken ct = default)
    {
        var tenantId = GetTenantId();
        await EnsureSeededAsync(tenantId, ct);

        var role = await db.RbacRoles.FirstOrDefaultAsync(r => r.TenantId == tenantId && r.Id == roleId, ct);
        if (role is null)
            return false;

        if (role.IsSystem)
            throw new InvalidOperationException("System roles cannot be deleted.");

        db.RbacRoles.Remove(role);
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<RoleDetailDto?> AssignPermissionsAsync(Guid roleId, IReadOnlyCollection<Guid> permissionIds, CancellationToken ct = default)
    {
        var tenantId = GetTenantId();
        await EnsureSeededAsync(tenantId, ct);

        var role = await db.RbacRoles.FirstOrDefaultAsync(r => r.TenantId == tenantId && r.Id == roleId, ct);
        if (role is null)
            return null;

        if (role.IsSystem)
            throw new InvalidOperationException("System role permissions are read-only.");

        if (permissionIds.Count == 0)
            return await GetRoleAsync(roleId, ct);

        var existing = await db.RolePermissions
            .Where(rp => rp.TenantId == tenantId && rp.RoleId == roleId && permissionIds.Contains(rp.PermissionId))
            .Select(rp => rp.PermissionId)
            .ToListAsync(ct);

        var toAdd = permissionIds.Except(existing).ToList();
        if (toAdd.Count > 0)
        {
            foreach (var permissionId in toAdd)
            {
                db.RolePermissions.Add(new RolePermission
                {
                    TenantId = tenantId,
                    RoleId = roleId,
                    PermissionId = permissionId
                });
            }

            role.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }

        return await GetRoleAsync(roleId, ct);
    }

    public async Task<RoleDetailDto?> RemovePermissionsAsync(Guid roleId, IReadOnlyCollection<Guid> permissionIds, CancellationToken ct = default)
    {
        var tenantId = GetTenantId();
        await EnsureSeededAsync(tenantId, ct);

        var role = await db.RbacRoles.FirstOrDefaultAsync(r => r.TenantId == tenantId && r.Id == roleId, ct);
        if (role is null)
            return null;

        if (role.IsSystem)
            throw new InvalidOperationException("System role permissions are read-only.");

        var rows = await db.RolePermissions
            .Where(rp => rp.TenantId == tenantId && rp.RoleId == roleId && permissionIds.Contains(rp.PermissionId))
            .ToListAsync(ct);

        if (rows.Count > 0)
        {
            db.RolePermissions.RemoveRange(rows);
            role.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }

        return await GetRoleAsync(roleId, ct);
    }

    public async Task<IReadOnlyList<PermissionCategoryDto>> ListPermissionsByCategoryAsync(CancellationToken ct = default)
    {
        var tenantId = GetTenantId();
        await EnsureSeededAsync(tenantId, ct);

        var permissions = await db.Permissions
            .AsNoTracking()
            .Where(p => p.TenantId == tenantId)
            .OrderBy(p => p.Category)
            .ThenBy(p => p.Name)
            .Select(p => new PermissionDto(p.Id, p.Name, p.Category, p.Description))
            .ToListAsync(ct);

        return permissions
            .GroupBy(p => p.Category)
            .Select(g => new PermissionCategoryDto(g.Key, g.ToList()))
            .ToList();
    }

    public async Task<bool> AssignUserRoleAsync(Guid userId, Guid roleId, CancellationToken ct = default)
    {
        var tenantId = GetTenantId();
        await EnsureSeededAsync(tenantId, ct);

        var roleExists = await db.RbacRoles.AnyAsync(r => r.TenantId == tenantId && r.Id == roleId, ct);
        if (!roleExists)
            return false;

        var userExists = await db.Set<AppUser>().AnyAsync(u => u.TenantId == tenantId && u.Id == userId, ct);
        if (!userExists)
            return false;

        var alreadyAssigned = await db.UserRolesMap.AnyAsync(
            ur => ur.TenantId == tenantId && ur.UserId == userId && ur.RoleId == roleId,
            ct);

        if (alreadyAssigned)
            return true;

        db.UserRolesMap.Add(new UserRole
        {
            TenantId = tenantId,
            UserId = userId,
            RoleId = roleId
        });

        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> RemoveUserRoleAsync(Guid userId, Guid roleId, CancellationToken ct = default)
    {
        var tenantId = GetTenantId();
        await EnsureSeededAsync(tenantId, ct);

        var row = await db.UserRolesMap.FirstOrDefaultAsync(
            ur => ur.TenantId == tenantId && ur.UserId == userId && ur.RoleId == roleId,
            ct);

        if (row is null)
            return false;

        db.UserRolesMap.Remove(row);
        await db.SaveChangesAsync(ct);
        return true;
    }

    private Guid GetTenantId()
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId == Guid.Empty)
            throw new InvalidOperationException("Tenant context is not resolved.");

        return tenantId;
    }

    public async Task EnsureSeededAsync(Guid tenantId, CancellationToken ct)
    {
        var existingPermissions = await db.Permissions
            .Where(p => p.TenantId == tenantId)
            .ToListAsync(ct);

        if (existingPermissions.Count == 0)
        {
            foreach (var seed in PermissionSeeds)
            {
                db.Permissions.Add(new Permission
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Name = seed.Name,
                    Category = seed.Category,
                    Description = seed.Description,
                    CreatedAt = DateTime.UtcNow
                });
            }

            await db.SaveChangesAsync(ct);
            existingPermissions = await db.Permissions
                .Where(p => p.TenantId == tenantId)
                .ToListAsync(ct);
        }

        var existingRoles = await db.RbacRoles
            .Where(r => r.TenantId == tenantId)
            .ToListAsync(ct);

        foreach (var seed in RoleSeeds)
        {
            if (existingRoles.Any(r => r.Name == seed.Name))
                continue;

            db.RbacRoles.Add(new Role
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = seed.Name,
                Description = seed.Description,
                IsSystem = seed.IsSystem,
                CreatedAt = DateTime.UtcNow
            });
        }

        await db.SaveChangesAsync(ct);

        var permissionByName = await db.Permissions
            .Where(p => p.TenantId == tenantId)
            .ToDictionaryAsync(p => p.Name, p => p.Id, ct);

        var roleByName = await db.RbacRoles
            .Where(r => r.TenantId == tenantId)
            .ToDictionaryAsync(r => r.Name, r => r.Id, ct);

        foreach (var roleSeed in RoleSeeds)
        {
            if (!roleByName.TryGetValue(roleSeed.Name, out var roleId))
                continue;

            var targetPermissionIds = ResolvePermissionIds(roleSeed.PermissionRules, permissionByName);

            foreach (var permissionId in targetPermissionIds)
            {
                var exists = await db.RolePermissions.AnyAsync(
                    rp => rp.TenantId == tenantId && rp.RoleId == roleId && rp.PermissionId == permissionId,
                    ct);

                if (exists)
                    continue;

                db.RolePermissions.Add(new RolePermission
                {
                    TenantId = tenantId,
                    RoleId = roleId,
                    PermissionId = permissionId
                });
            }
        }

        await db.SaveChangesAsync(ct);
    }

    private static List<Guid> ResolvePermissionIds(string[] rules, IReadOnlyDictionary<string, Guid> permissionByName)
    {
        var names = permissionByName.Keys;
        var selected = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var rule in rules)
        {
            if (rule == "*")
            {
                foreach (var name in names)
                    selected.Add(name);
                continue;
            }

            if (rule.StartsWith('.') && rule.Equals(".View", StringComparison.OrdinalIgnoreCase))
            {
                foreach (var name in names.Where(n => n.EndsWith(rule, StringComparison.OrdinalIgnoreCase)))
                    selected.Add(name);
                continue;
            }

            if (rule.EndsWith('.'))
            {
                foreach (var name in names.Where(n => n.StartsWith(rule, StringComparison.OrdinalIgnoreCase)))
                    selected.Add(name);
                continue;
            }

            if (permissionByName.ContainsKey(rule))
                selected.Add(rule);
        }

        return selected
            .Where(permissionByName.ContainsKey)
            .Select(name => permissionByName[name])
            .ToList();
    }

    private sealed record PermissionSeed(string Name, string Category, string Description);
    private sealed record RoleSeed(string Name, string Description, bool IsSystem, string[] PermissionRules);
}

public sealed record RoleListItemDto(
    Guid Id,
    string Name,
    string? Description,
    bool IsSystem,
    int PermissionCount,
    int UserCount);

public sealed record RoleDetailDto(
    Guid Id,
    string Name,
    string? Description,
    bool IsSystem,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    IReadOnlyList<PermissionDto> Permissions,
    IReadOnlyList<AssignedUserDto> AssignedUsers);

public sealed record PermissionDto(
    Guid Id,
    string Name,
    string Category,
    string? Description);

public sealed record PermissionCategoryDto(
    string Category,
    IReadOnlyList<PermissionDto> Permissions);

public sealed record AssignedUserDto(
    Guid Id,
    string FullName,
    string Email);

public sealed record CreateRoleDto(
    string Name,
    string? Description);

public sealed record UpdateRoleDto(
    string Name,
    string? Description);
