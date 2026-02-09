using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Admin audit log viewer - immutable record of all system activity
/// NOTE: Database persistence pending EF migration. Returns placeholder data.
/// </summary>
[ApiController]
[Route("api/admin/audit-logs")]
[Authorize(Roles = "Admin")]
[Produces("application/json")]
[Tags("Admin - Audit Logs")]
public class AdminAuditController : ControllerBase
{
    /// <summary>
    /// List audit logs with filtering and pagination
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(AuditLogListResponse), StatusCodes.Status200OK)]
    public Task<IActionResult> ListLogs(
        [FromQuery] Guid? userId,
        [FromQuery] AuditAction? action,
        [FromQuery] string? resourceType,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] bool? success,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        // TODO: Implement once EF migration is done
        // For now return empty list - audit logging infrastructure ready
        return Task.FromResult<IActionResult>(Ok(new AuditLogListResponse
        {
            Items = [],
            TotalCount = 0,
            Page = page,
            PageSize = pageSize,
            TotalPages = 0
        }));
    }

    /// <summary>
    /// Get distinct resource types for filtering
    /// </summary>
    [HttpGet("resource-types")]
    [ProducesResponseType(typeof(List<string>), StatusCodes.Status200OK)]
    public IActionResult GetResourceTypes()
    {
        // Return common resource types as placeholders
        var types = new List<string> { "Employee", "Project", "Bid", "User", "Contract", "TimeEntry" };
        return Ok(types);
    }

    /// <summary>
    /// Get available action types for filtering
    /// </summary>
    [HttpGet("actions")]
    [ProducesResponseType(typeof(List<string>), StatusCodes.Status200OK)]
    public IActionResult GetActions()
    {
        var actions = Enum.GetNames<AuditAction>().ToList();
        return Ok(actions);
    }
}

public record AuditLogDto
{
    public Guid Id { get; init; }
    public Guid? UserId { get; init; }
    public string? UserEmail { get; init; }
    public string? UserName { get; init; }
    public string Action { get; init; } = string.Empty;
    public string ResourceType { get; init; } = string.Empty;
    public string? ResourceId { get; init; }
    public string Description { get; init; } = string.Empty;
    public string? Details { get; init; }
    public string? IpAddress { get; init; }
    public DateTime Timestamp { get; init; }
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }
}

public record AuditLogListResponse
{
    public List<AuditLogDto> Items { get; init; } = [];
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalPages { get; init; }
}
