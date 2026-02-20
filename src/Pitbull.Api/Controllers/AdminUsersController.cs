using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pitbull.Api.Infrastructure;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Admin user management - list, update roles, activate/deactivate users
/// </summary>
[ApiController]
[Route("api/admin/users")]
[Authorize(Policy = "Admin.Users")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Admin - Users")]
public class AdminUsersController(
    PitbullDbContext db,
    UserManager<AppUser> userManager,
    RoleManager<AppRole> roleManager,
    RoleSeeder roleSeeder) : ControllerBase
{
    /// <summary>
    /// List all users in the tenant with their roles
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(AdminListUsersResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListUsers(
        [FromQuery] string? search,
        [FromQuery] string? role,
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 100)
    {
        var query = db.Users.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(u =>
                u.Email!.ToLower().Contains(searchLower) ||
                u.FirstName!.ToLower().Contains(searchLower) ||
                u.LastName!.ToLower().Contains(searchLower));
        }

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<UserStatus>(status, ignoreCase: true, out var parsedStatus))
        {
            query = query.Where(u => u.Status == parsedStatus);
        }

        var users = await query.OrderBy(u => u.LastName).ThenBy(u => u.FirstName).ToListAsync();

        var allItems = new List<AdminUserDto>();
        foreach (var user in users)
        {
            var roles = await roleSeeder.GetUserRolesAsync(user);

            if (!string.IsNullOrWhiteSpace(role) && !roles.Contains(role, StringComparer.OrdinalIgnoreCase))
                continue;

            allItems.Add(MapToDto(user, roles.ToList()));
        }

        var totalCount = allItems.Count;
        var items = allItems.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        return Ok(new AdminListUsersResult
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        });
    }

    /// <summary>
    /// Get a single user by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(AdminUserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetUser(Guid id)
    {
        var user = await db.Users.FindAsync(id);
        if (user == null)
            return NotFound(new { error = "User not found" });

        var roles = await roleSeeder.GetUserRolesAsync(user);

        return Ok(MapToDto(user, roles.ToList()));
    }

    /// <summary>
    /// Update a user's role and status
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(AdminUserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateUser(Guid id, [FromBody] UpdateUserRequest request)
    {
        var user = await db.Users.FindAsync(id);
        if (user == null)
            return NotFound(new { error = "User not found" });

        // Update basic info
        if (!string.IsNullOrWhiteSpace(request.FirstName))
        {
            if (request.FirstName.Trim().Length > 100)
                return BadRequest(new { error = "First name cannot exceed 100 characters" });
            user.FirstName = request.FirstName.Trim();
        }
        if (!string.IsNullOrWhiteSpace(request.LastName))
        {
            if (request.LastName.Trim().Length > 100)
                return BadRequest(new { error = "Last name cannot exceed 100 characters" });
            user.LastName = request.LastName.Trim();
        }
        if (request.Status != null)
        {
            if (!Enum.TryParse<UserStatus>(request.Status, out var status))
                return BadRequest(new { error = "Invalid user status value" });
            user.Status = status;
        }

        // Update employee link
        if (request.EmployeeId.HasValue)
        {
            if (request.EmployeeId.Value == Guid.Empty)
                user.EmployeeId = null; // Explicitly unlink
            else
                user.EmployeeId = request.EmployeeId.Value;
        }

        // Update company link
        if (request.CompanyId.HasValue)
        {
            if (request.CompanyId.Value == Guid.Empty)
                user.CompanyId = null; // Explicitly unlink
            else
                user.CompanyId = request.CompanyId.Value;
        }

        // Update roles if provided (frontend sends short names like "Admin", DB stores "{tenantId}:Admin")
        if (request.Roles != null)
        {
            var currentRoles = await userManager.GetRolesAsync(user);
            await userManager.RemoveFromRolesAsync(user, currentRoles);

            foreach (var roleName in request.Roles)
            {
                var tenantRoleName = $"{user.TenantId}:{roleName}";
                if (await roleManager.RoleExistsAsync(tenantRoleName))
                {
                    await userManager.AddToRoleAsync(user, tenantRoleName);
                }
            }
        }

        await db.SaveChangesAsync();

        var roles = await roleSeeder.GetUserRolesAsync(user);
        return Ok(MapToDto(user, roles.ToList()));
    }

    /// <summary>
    /// Get all available roles
    /// </summary>
    [HttpGet("roles")]
    [ProducesResponseType(typeof(List<RoleDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRoles()
    {
        var tenantClaim = User.FindFirst("tenant_id")?.Value;
        var tenantId = Guid.TryParse(tenantClaim, out var tid) ? tid : Guid.Empty;
        var tenantPrefix = $"{tenantId}:";
        var roles = await roleManager.Roles
            .Where(r => r.Name != null && r.Name.StartsWith(tenantPrefix))
            .ToListAsync();
        return Ok(roles.Select(r =>
        {
            // Strip tenant prefix (e.g., "{guid}:Admin" → "Admin")
            var name = r.Name ?? string.Empty;
            var colonIdx = name.IndexOf(':');
            var displayName = colonIdx >= 0 ? name[(colonIdx + 1)..] : name;

            return new RoleDto
            {
                Id = r.Id,
                Name = displayName,
                Description = r.Description ?? displayName
            };
        }).ToList());
    }

    /// <summary>
    /// Bootstrap: Make current user an Admin (one-time setup)
    /// Only works if no admin exists in the tenant yet. Once an admin exists,
    /// this endpoint is permanently disabled — use the normal user management
    /// endpoints to grant admin roles.
    /// </summary>
    [HttpPost("bootstrap-admin")]
    [AllowAnonymous] // Allow first-time setup
    [EnableRateLimiting("auth")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> BootstrapAdmin([FromBody] BootstrapAdminRequest request)
    {
        // Find the user by email
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
        if (user == null)
            return NotFound(new { error = "User not found" });

        // Ensure roles exist for the tenant
        var tenantId = user.TenantId;

        // Guard: once an admin exists for this tenant, bootstrap is permanently disabled.
        // This prevents privilege escalation — any authenticated user could previously
        // call this endpoint to grant themselves admin access.
        var adminRoleNameForCheck = $"{tenantId}:Admin";
        var existingAdminRole = await roleManager.FindByNameAsync(adminRoleNameForCheck);
        if (existingAdminRole != null)
        {
            var adminExists = await db.UserRoles
                .AnyAsync(ur => ur.RoleId == existingAdminRole.Id);

            if (adminExists)
            {
                return StatusCode(StatusCodes.Status403Forbidden,
                    new { error = "Bootstrap is disabled — an admin already exists for this tenant. Use the admin user management API to grant roles." });
            }
        }
        var adminRoleName = $"{tenantId}:Admin";

        // Check if admin role exists
        var adminRole = await roleManager.FindByNameAsync(adminRoleName);
        if (adminRole == null)
        {
            // Create admin role for this tenant
            adminRole = new AppRole
            {
                Id = Guid.NewGuid(),
                Name = adminRoleName,
                NormalizedName = adminRoleName.ToUpperInvariant(),
                TenantId = tenantId,
                Description = "Full system access. Can manage users, roles, and all settings.",
                IsSystemRole = true
            };
            await roleManager.CreateAsync(adminRole);
        }

        // Check if user already has admin role
        if (await userManager.IsInRoleAsync(user, adminRoleName))
            return Ok(new { message = $"User {request.Email} is already an Admin" });

        // Add user to admin role
        var result = await userManager.AddToRoleAsync(user, adminRoleName);
        if (!result.Succeeded)
        {
            return BadRequest(new { error = "Failed to assign admin role" });
        }

        // Also add all other roles for full access
        foreach (var roleName in new[] { "Manager", "Supervisor", "User" })
        {
            var fullRoleName = $"{tenantId}:{roleName}";
            var role = await roleManager.FindByNameAsync(fullRoleName);
            if (role == null)
            {
                role = new AppRole
                {
                    Id = Guid.NewGuid(),
                    Name = fullRoleName,
                    NormalizedName = fullRoleName.ToUpperInvariant(),
                    TenantId = tenantId,
                    Description = roleName,
                    IsSystemRole = true
                };
                await roleManager.CreateAsync(role);
            }

            if (!await userManager.IsInRoleAsync(user, fullRoleName))
                await userManager.AddToRoleAsync(user, fullRoleName);
        }

        return Ok(new
        {
            message = $"User {request.Email} is now an Admin with full access",
            roles = new[] { "Admin", "Manager", "Supervisor", "User" }
        });
    }

    private static AdminUserDto MapToDto(AppUser user, List<string> roles) => new()
    {
        Id = user.Id,
        Email = user.Email!,
        FirstName = user.FirstName,
        LastName = user.LastName,
        FullName = user.FullName,
        Status = user.Status.ToString(),
        LastLoginAt = user.LastLoginAt,
        CreatedAt = user.CreatedAt,
        Roles = roles,
        EmployeeId = user.EmployeeId,
        CompanyId = user.CompanyId
    };
}

public record BootstrapAdminRequest
{
    public string Email { get; init; } = string.Empty;
}

public record AdminUserDto
{
    public Guid Id { get; init; }
    public string Email { get; init; } = string.Empty;
    public string? FirstName { get; init; }
    public string? LastName { get; init; }
    public string FullName { get; init; } = string.Empty;
    public string Status { get; init; } = "Active";
    public DateTime? LastLoginAt { get; init; }
    public DateTime CreatedAt { get; init; }
    public List<string> Roles { get; init; } = [];
    public Guid? EmployeeId { get; init; }
    public Guid? CompanyId { get; init; }
}

public record AdminListUsersResult
{
    public List<AdminUserDto> Items { get; init; } = [];
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
}

public record UpdateUserRequest
{
    public string? FirstName { get; init; }
    public string? LastName { get; init; }
    public string? Status { get; init; }
    public List<string>? Roles { get; init; }
    /// <summary>
    /// Link user to an employee record. Send Guid.Empty to unlink.
    /// </summary>
    public Guid? EmployeeId { get; init; }
    /// <summary>
    /// Set user's default company. Send Guid.Empty to unlink.
    /// </summary>
    public Guid? CompanyId { get; init; }
}

public record RoleDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
}
