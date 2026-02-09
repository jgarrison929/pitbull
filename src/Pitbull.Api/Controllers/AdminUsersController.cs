using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Admin user management - list, update roles, activate/deactivate users
/// </summary>
[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = "Admin")]
[Produces("application/json")]
[Tags("Admin - Users")]
public class AdminUsersController(
    PitbullDbContext db,
    UserManager<AppUser> userManager,
    RoleManager<AppRole> roleManager) : ControllerBase
{
    /// <summary>
    /// List all users in the tenant with their roles
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<AdminUserDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListUsers([FromQuery] string? search, [FromQuery] string? role, [FromQuery] bool? isActive)
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

        if (isActive.HasValue)
        {
            query = query.Where(u => isActive.Value 
                ? u.Status == UserStatus.Active 
                : u.Status != UserStatus.Active);
        }

        var users = await query.OrderBy(u => u.LastName).ThenBy(u => u.FirstName).ToListAsync();
        
        var result = new List<AdminUserDto>();
        foreach (var user in users)
        {
            var roles = await userManager.GetRolesAsync(user);
            
            if (!string.IsNullOrWhiteSpace(role) && !roles.Contains(role, StringComparer.OrdinalIgnoreCase))
                continue;

            result.Add(new AdminUserDto
            {
                Id = user.Id,
                Email = user.Email!,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Status = user.Status.ToString(),
                LastLoginAt = user.LastLoginAt,
                CreatedAt = user.CreatedAt,
                Roles = roles.ToList()
            });
        }

        return Ok(result);
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

        var roles = await userManager.GetRolesAsync(user);

        return Ok(new AdminUserDto
        {
            Id = user.Id,
            Email = user.Email!,
            FirstName = user.FirstName,
            LastName = user.LastName,
            Status = user.Status.ToString(),
            LastLoginAt = user.LastLoginAt,
            CreatedAt = user.CreatedAt,
            Roles = roles.ToList()
        });
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
            user.FirstName = request.FirstName;
        if (!string.IsNullOrWhiteSpace(request.LastName))
            user.LastName = request.LastName;
        if (request.Status != null)
            user.Status = Enum.Parse<UserStatus>(request.Status);

        // Update roles if provided
        if (request.Roles != null)
        {
            var currentRoles = await userManager.GetRolesAsync(user);
            await userManager.RemoveFromRolesAsync(user, currentRoles);
            
            foreach (var roleName in request.Roles)
            {
                if (await roleManager.RoleExistsAsync(roleName))
                {
                    await userManager.AddToRoleAsync(user, roleName);
                }
            }
        }

        await db.SaveChangesAsync();

        var roles = await userManager.GetRolesAsync(user);
        return Ok(new AdminUserDto
        {
            Id = user.Id,
            Email = user.Email!,
            FirstName = user.FirstName,
            LastName = user.LastName,
            Status = user.Status.ToString(),
            LastLoginAt = user.LastLoginAt,
            CreatedAt = user.CreatedAt,
            Roles = roles.ToList()
        });
    }

    /// <summary>
    /// Get all available roles
    /// </summary>
    [HttpGet("roles")]
    [ProducesResponseType(typeof(List<RoleDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRoles()
    {
        var roles = await roleManager.Roles.ToListAsync();
        return Ok(roles.Select(r => new RoleDto { Id = r.Id, Name = r.Name! }).ToList());
    }
}

public record AdminUserDto
{
    public Guid Id { get; init; }
    public string Email { get; init; } = string.Empty;
    public string? FirstName { get; init; }
    public string? LastName { get; init; }
    public string Status { get; init; } = "Active";
    public DateTime? LastLoginAt { get; init; }
    public DateTime CreatedAt { get; init; }
    public List<string> Roles { get; init; } = [];
}

public record UpdateUserRequest
{
    public string? FirstName { get; init; }
    public string? LastName { get; init; }
    public string? Status { get; init; }
    public List<string>? Roles { get; init; }
}

public record RoleDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
}
