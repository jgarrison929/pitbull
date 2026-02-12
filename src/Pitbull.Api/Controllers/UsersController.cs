using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pitbull.Api.Extensions;
using Pitbull.Api.Infrastructure;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Api.Controllers;

/// <summary>
/// User management endpoints for tenant administrators.
/// All endpoints require Admin role.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[ApiExplorerSettings(GroupName = "v1")]
public class UsersController(
    UserManager<AppUser> userManager,
    RoleSeeder roleSeeder,
    PitbullDbContext db,
    ITenantContext tenantContext,
    ILogger<UsersController> logger) : ControllerBase
{
    private Guid GetCurrentUserId()
    {
        var sub = User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                  ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(sub, out var id) ? id : Guid.Empty;
    }

    /// <summary>
    /// List all users in the current tenant
    /// </summary>
    /// <remarks>
    /// Returns paginated list of users with their roles.
    /// Only accessible by Admin users.
    /// </remarks>
    /// <param name="search">Optional search term for name/email</param>
    /// <param name="page">Page number (1-based)</param>
    /// <param name="pageSize">Items per page (default 20, max 100)</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Paginated list of users</returns>
    [HttpGet]
    [ProducesResponseType(typeof(ListUsersResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ListUsers(
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId == Guid.Empty)
            return this.UnauthorizedError("Invalid tenant");

        pageSize = Math.Clamp(pageSize, 1, 100);
        page = Math.Max(1, page);

        var query = db.Set<AppUser>()
            .Where(u => u.TenantId == tenantId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(u =>
                u.FirstName.ToLower().Contains(searchLower) ||
                u.LastName.ToLower().Contains(searchLower) ||
                u.Email!.ToLower().Contains(searchLower));
        }

        var totalCount = await query.CountAsync(ct);

        var users = await query
            .OrderBy(u => u.LastName)
            .ThenBy(u => u.FirstName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new UserListItem(
                u.Id,
                u.Email!,
                u.FirstName,
                u.LastName,
                u.FullName,
                u.Status,
                u.Type,
                u.CreatedAt,
                u.LastLoginAt
            ))
            .ToListAsync(ct);

        // Load roles for each user (batch query)
        var userIds = users.Select(u => u.Id).ToList();
        var userRoles = await GetUserRolesAsync(tenantId, userIds, ct);

        var items = users.Select(u => new UserDto(
            u.Id,
            u.Email,
            u.FirstName,
            u.LastName,
            u.FullName,
            u.Status.ToString(),
            u.Type.ToString(),
            userRoles.GetValueOrDefault(u.Id, []),
            u.CreatedAt,
            u.LastLoginAt
        )).ToList();

        return Ok(new ListUsersResult(items, totalCount, page, pageSize));
    }

    /// <summary>
    /// Get a specific user by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetUser(Guid id, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId == Guid.Empty)
            return this.UnauthorizedError("Invalid tenant");

        var user = await db.Set<AppUser>()
            .Where(u => u.TenantId == tenantId && u.Id == id)
            .FirstOrDefaultAsync(ct);

        if (user is null)
            return this.NotFoundError("User not found");

        var roles = await roleSeeder.GetUserRolesAsync(user);

        return Ok(new UserDto(
            user.Id,
            user.Email!,
            user.FirstName,
            user.LastName,
            user.FullName,
            user.Status.ToString(),
            user.Type.ToString(),
            roles.ToArray(),
            user.CreatedAt,
            user.LastLoginAt
        ));
    }

    /// <summary>
    /// Assign a role to a user
    /// </summary>
    [HttpPost("{id:guid}/roles")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AssignRole(Guid id, [FromBody] RoleAssignmentRequest request, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId == Guid.Empty)
            return this.UnauthorizedError("Invalid tenant");

        // Validate role name
        if (!RoleSeeder.Roles.All.Contains(request.Role))
            return this.BadRequestError($"Invalid role: {request.Role}. Valid roles: {string.Join(", ", RoleSeeder.Roles.All)}");

        var user = await db.Set<AppUser>()
            .Where(u => u.TenantId == tenantId && u.Id == id)
            .FirstOrDefaultAsync(ct);

        if (user is null)
            return this.NotFoundError("User not found");

        await roleSeeder.AssignRoleToUserAsync(user, request.Role, ct);
        logger.LogInformation("Admin {AdminId} assigned role {Role} to user {UserId}",
            GetCurrentUserId(), request.Role, id);

        var roles = await roleSeeder.GetUserRolesAsync(user);
        return Ok(new { roles });
    }

    /// <summary>
    /// Remove a role from a user
    /// </summary>
    [HttpDelete("{id:guid}/roles/{role}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveRole(Guid id, string role, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId == Guid.Empty)
            return this.UnauthorizedError("Invalid tenant");

        // Validate role name
        if (!RoleSeeder.Roles.All.Contains(role))
            return this.BadRequestError($"Invalid role: {role}");

        var user = await db.Set<AppUser>()
            .Where(u => u.TenantId == tenantId && u.Id == id)
            .FirstOrDefaultAsync(ct);

        if (user is null)
            return this.NotFoundError("User not found");

        // Prevent removing own Admin role
        var currentUserId = GetCurrentUserId();
        if (id == currentUserId && role == RoleSeeder.Roles.Admin)
            return this.BadRequestError("You cannot remove your own Admin role");

        var tenantRoleName = $"{tenantId}:{role}";
        var result = await userManager.RemoveFromRoleAsync(user, tenantRoleName);

        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            return this.BadRequestError($"Failed to remove role: {errors}");
        }

        logger.LogInformation("Admin {AdminId} removed role {Role} from user {UserId}",
            currentUserId, role, id);

        var roles = await roleSeeder.GetUserRolesAsync(user);
        return Ok(new { roles });
    }

    /// <summary>
    /// Get available roles
    /// </summary>
    [HttpGet("roles")]
    [ProducesResponseType(typeof(RoleInfo[]), StatusCodes.Status200OK)]
    public IActionResult GetRoles()
    {
        var roles = RoleSeeder.Roles.All
            .Select(r => new RoleInfo(r, RoleSeeder.Roles.Descriptions[r]))
            .ToArray();

        return Ok(roles);
    }

    private async Task<Dictionary<Guid, string[]>> GetUserRolesAsync(Guid tenantId, List<Guid> userIds, CancellationToken ct)
    {
        var prefix = $"{tenantId}:";
        
        var userRoleData = await db.Set<IdentityUserRole<Guid>>()
            .Where(ur => userIds.Contains(ur.UserId))
            .Join(
                db.Set<AppRole>().Where(r => r.TenantId == tenantId),
                ur => ur.RoleId,
                r => r.Id,
                (ur, r) => new { ur.UserId, r.Name })
            .ToListAsync(ct);

        return userRoleData
            .GroupBy(x => x.UserId)
            .ToDictionary(
                g => g.Key,
                g => g.Select(x => x.Name![prefix.Length..]).ToArray()
            );
    }
}

// DTOs
public record ListUsersResult(
    List<UserDto> Items,
    int TotalCount,
    int Page,
    int PageSize);

public record UserListItem(
    Guid Id,
    string Email,
    string FirstName,
    string LastName,
    string FullName,
    UserStatus Status,
    UserType Type,
    DateTime CreatedAt,
    DateTime? LastLoginAt);

public record UserDto(
    Guid Id,
    string Email,
    string FirstName,
    string LastName,
    string FullName,
    string Status,
    string Type,
    string[] Roles,
    DateTime CreatedAt,
    DateTime? LastLoginAt);

public record RoleAssignmentRequest(string Role);

public record RoleInfo(string Name, string Description);
