using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Role and permission management for the tenant.
/// </summary>
[ApiController]
[Route("api/admin/roles")]
[Authorize(Policy = "Admin.Roles")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Admin - Roles")]
public class AdminRolesController(RoleManager<AppRole> roleManager, ILogger<AdminRolesController> logger) : ControllerBase
{
    /// <summary>
    /// List all roles for the tenant
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<AdminRoleDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListRoles()
    {
        var roles = await roleManager.Roles
            .OrderBy(r => r.Name)
            .ToListAsync();

        return Ok(roles.Select(r => new AdminRoleDto
        {
            Id = r.Id,
            Name = r.Name!,
            Description = r.Description,
            IsSystemRole = r.IsSystemRole,
            TenantId = r.TenantId
        }).ToList());
    }

    /// <summary>
    /// Create a new custom role
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(AdminRoleDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateRole([FromBody] CreateRoleRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "Role name is required", code = "VALIDATION_ERROR" });

        var tenantClaim = User.FindFirst("tenant_id")?.Value;
        var tenantId = Guid.TryParse(tenantClaim, out var tid) ? tid : Guid.Empty;

        var fullRoleName = $"{tenantId}:{request.Name}";

        var existing = await roleManager.FindByNameAsync(fullRoleName);
        if (existing != null)
            return Conflict(new { error = "Role already exists", code = "DUPLICATE_ROLE" });

        var role = new AppRole
        {
            Id = Guid.NewGuid(),
            Name = fullRoleName,
            NormalizedName = fullRoleName.ToUpperInvariant(),
            TenantId = tenantId,
            Description = request.Description,
            IsSystemRole = false
        };

        var result = await roleManager.CreateAsync(role);
        if (!result.Succeeded)
        {
            logger.LogWarning("Role creation failed: {Errors}", string.Join(", ", result.Errors.Select(e => e.Description)));
            return BadRequest(new { error = "Failed to create role", code = "ROLE_ERROR" });
        }

        return StatusCode(StatusCodes.Status201Created, new AdminRoleDto
        {
            Id = role.Id,
            Name = role.Name,
            Description = role.Description,
            IsSystemRole = role.IsSystemRole,
            TenantId = role.TenantId
        });
    }

    /// <summary>
    /// Update a custom role's description
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(AdminRoleDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateRole(Guid id, [FromBody] UpdateRoleRequest request)
    {
        var role = await roleManager.FindByIdAsync(id.ToString());
        if (role == null)
            return NotFound(new { error = "Role not found" });

        if (role.IsSystemRole)
            return BadRequest(new { error = "Cannot modify system roles", code = "SYSTEM_ROLE" });

        role.Description = request.Description;
        var result = await roleManager.UpdateAsync(role);

        if (!result.Succeeded)
        {
            logger.LogWarning("Role update failed: {Errors}", string.Join(", ", result.Errors.Select(e => e.Description)));
            return BadRequest(new { error = "Failed to update role", code = "ROLE_ERROR" });
        }

        return Ok(new AdminRoleDto
        {
            Id = role.Id,
            Name = role.Name!,
            Description = role.Description,
            IsSystemRole = role.IsSystemRole,
            TenantId = role.TenantId
        });
    }

    /// <summary>
    /// Delete a custom role (system roles cannot be deleted)
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteRole(Guid id)
    {
        var role = await roleManager.FindByIdAsync(id.ToString());
        if (role == null)
            return NotFound(new { error = "Role not found" });

        if (role.IsSystemRole)
            return BadRequest(new { error = "Cannot delete system roles", code = "SYSTEM_ROLE" });

        var result = await roleManager.DeleteAsync(role);
        if (!result.Succeeded)
        {
            logger.LogWarning("Role deletion failed: {Errors}", string.Join(", ", result.Errors.Select(e => e.Description)));
            return BadRequest(new { error = "Failed to delete role", code = "ROLE_ERROR" });
        }

        return NoContent();
    }
}

public record AdminRoleDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public bool IsSystemRole { get; init; }
    public Guid TenantId { get; init; }
}

public record CreateRoleRequest
{
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
}

public record UpdateRoleRequest
{
    public string? Description { get; init; }
}
