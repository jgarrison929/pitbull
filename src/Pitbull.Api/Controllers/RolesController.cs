using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Services;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize(Roles = "Admin")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Roles")]
public class RolesController(IRoleService roleService, ILogger<RolesController> logger) : ControllerBase
{
    [HttpGet("roles")]
    [ProducesResponseType(typeof(IReadOnlyList<RoleListItemDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListRoles(CancellationToken ct)
    {
        var roles = await roleService.ListRolesAsync(ct);
        return Ok(roles);
    }

    [HttpGet("roles/{id:guid}")]
    [ProducesResponseType(typeof(RoleDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetRole(Guid id, CancellationToken ct)
    {
        var role = await roleService.GetRoleAsync(id, ct);
        if (role is null)
            return NotFound(new { error = "Role not found" });

        return Ok(role);
    }

    [HttpPost("roles")]
    [ProducesResponseType(typeof(RoleDetailDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateRole([FromBody] RbacCreateRoleRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "Role name is required", code = "VALIDATION_ERROR" });

        try
        {
            var role = await roleService.CreateRoleAsync(new CreateRoleDto(request.Name, request.Description), ct);
            return Created($"/api/roles/{role.Id}", role);
        }
        catch (InvalidOperationException ex)
        {
            logger.LogWarning(ex, "Role creation failed");
            return BadRequest(new { error = "Role creation failed", code = "ROLE_ERROR" });
        }
    }

    [HttpPut("roles/{id:guid}")]
    [ProducesResponseType(typeof(RoleDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateRole(Guid id, [FromBody] RbacUpdateRoleRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "Role name is required", code = "VALIDATION_ERROR" });

        RoleDetailDto? updated;
        try
        {
            updated = await roleService.UpdateRoleAsync(id, new UpdateRoleDto(request.Name, request.Description), ct);
            if (updated is null)
                return NotFound(new { error = "Role not found" });
        }
        catch (InvalidOperationException ex)
        {
            logger.LogWarning(ex, "Role update failed");
            return BadRequest(new { error = "Role update failed", code = "ROLE_ERROR" });
        }

        return Ok(updated);
    }

    [HttpDelete("roles/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> DeleteRole(Guid id, CancellationToken ct)
    {
        try
        {
            var deleted = await roleService.DeleteRoleAsync(id, ct);
            if (!deleted)
                return NotFound(new { error = "Role not found" });

            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            logger.LogWarning(ex, "Role deletion failed");
            return BadRequest(new { error = "Role deletion failed", code = "ROLE_ERROR" });
        }
    }

    [HttpPost("roles/{id:guid}/permissions")]
    [ProducesResponseType(typeof(RoleDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AssignPermissions(Guid id, [FromBody] PermissionIdsRequest request, CancellationToken ct)
    {
        var role = await roleService.AssignPermissionsAsync(id, request.PermissionIds, ct);
        if (role is null)
            return NotFound(new { error = "Role not found" });

        return Ok(role);
    }

    [HttpDelete("roles/{id:guid}/permissions")]
    [ProducesResponseType(typeof(RoleDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RemovePermissions(Guid id, [FromBody] PermissionIdsRequest request, CancellationToken ct)
    {
        try
        {
            var role = await roleService.RemovePermissionsAsync(id, request.PermissionIds, ct);
            if (role is null)
                return NotFound(new { error = "Role not found" });

            return Ok(role);
        }
        catch (InvalidOperationException ex)
        {
            logger.LogWarning(ex, "Permission removal failed");
            return BadRequest(new { error = "Permission removal failed", code = "ROLE_ERROR" });
        }
    }

    [HttpGet("permissions")]
    [ProducesResponseType(typeof(IReadOnlyList<PermissionCategoryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListPermissions(CancellationToken ct)
    {
        var permissions = await roleService.ListPermissionsByCategoryAsync(ct);
        return Ok(permissions);
    }

    [HttpPost("users/{id:guid}/roles")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AssignRoleToUser(Guid id, [FromBody] AssignUserRoleRequest request, CancellationToken ct)
    {
        var assigned = await roleService.AssignUserRoleAsync(id, request.RoleId, ct);
        if (!assigned)
            return NotFound(new { error = "User or role not found" });

        return NoContent();
    }
}

public sealed record RbacCreateRoleRequest(string Name, string? Description);
public sealed record RbacUpdateRoleRequest(string Name, string? Description);
public sealed record PermissionIdsRequest(IReadOnlyCollection<Guid> PermissionIds);
public sealed record AssignUserRoleRequest(Guid RoleId);
