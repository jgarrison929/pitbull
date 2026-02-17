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
public class RolesController(IRoleService roleService) : ControllerBase
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
            return NotFound(new { message = "Role not found" });

        return Ok(role);
    }

    [HttpPost("roles")]
    [ProducesResponseType(typeof(RoleDetailDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateRole([FromBody] RbacCreateRoleRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Role name is required" });

        try
        {
            var role = await roleService.CreateRoleAsync(new CreateRoleDto(request.Name, request.Description), ct);
            return Created($"/api/roles/{role.Id}", role);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("roles/{id:guid}")]
    [ProducesResponseType(typeof(RoleDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateRole(Guid id, [FromBody] RbacUpdateRoleRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Role name is required" });

        RoleDetailDto? updated;
        try
        {
            updated = await roleService.UpdateRoleAsync(id, new UpdateRoleDto(request.Name, request.Description), ct);
            if (updated is null)
                return NotFound(new { message = "Role not found" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
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
                return NotFound(new { message = "Role not found" });

            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("roles/{id:guid}/permissions")]
    [ProducesResponseType(typeof(RoleDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AssignPermissions(Guid id, [FromBody] PermissionIdsRequest request, CancellationToken ct)
    {
        var role = await roleService.AssignPermissionsAsync(id, request.PermissionIds, ct);
        if (role is null)
            return NotFound(new { message = "Role not found" });

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
                return NotFound(new { message = "Role not found" });

            return Ok(role);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
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
            return NotFound(new { message = "User or role not found" });

        return NoContent();
    }
}

public sealed record RbacCreateRoleRequest(string Name, string? Description);
public sealed record RbacUpdateRoleRequest(string Name, string? Description);
public sealed record PermissionIdsRequest(IReadOnlyCollection<Guid> PermissionIds);
public sealed record AssignUserRoleRequest(Guid RoleId);
