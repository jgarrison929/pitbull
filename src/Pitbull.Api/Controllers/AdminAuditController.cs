using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Admin audit log viewer - immutable record of all system activity
/// </summary>
[ApiController]
[Route("api/admin/audit-logs")]
[Authorize(Roles = "Admin")]
[Produces("application/json")]
[Tags("Admin - Audit Logs")]
public class AdminAuditController(PitbullDbContext db) : ControllerBase
{
    /// <summary>
    /// List audit logs with filtering and pagination
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(AuditLogListResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListLogs(
        [FromQuery] Guid? userId,
        [FromQuery] AuditAction? action,
        [FromQuery] string? resourceType,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] bool? success,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var query = db.Set<AuditLog>().AsNoTracking().AsQueryable();

        if (userId.HasValue)
            query = query.Where(a => a.UserId == userId);
        if (action.HasValue)
            query = query.Where(a => a.Action == action);
        if (!string.IsNullOrEmpty(resourceType))
            query = query.Where(a => a.ResourceType == resourceType);
        if (from.HasValue)
            query = query.Where(a => a.Timestamp >= from);
        if (to.HasValue)
            query = query.Where(a => a.Timestamp <= to);
        if (success.HasValue)
            query = query.Where(a => a.Success == success);

        var totalCount = await query.CountAsync();
        var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        var items = await query
            .OrderByDescending(a => a.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new AuditLogDto
            {
                Id = a.Id,
                UserId = a.UserId,
                UserEmail = a.UserEmail,
                UserName = a.UserName,
                Action = a.Action.ToString(),
                ResourceType = a.ResourceType,
                ResourceId = a.ResourceId,
                Description = a.Description,
                Details = a.Details,
                IpAddress = a.IpAddress,
                Timestamp = a.Timestamp,
                Success = a.Success,
                ErrorMessage = a.ErrorMessage
            })
            .ToListAsync();

        return Ok(new AuditLogListResponse
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = totalPages
        });
    }

    /// <summary>
    /// Get distinct resource types for filtering
    /// </summary>
    [HttpGet("resource-types")]
    [ProducesResponseType(typeof(List<string>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetResourceTypes()
    {
        var types = await db.Set<AuditLog>()
            .AsNoTracking()
            .Select(a => a.ResourceType)
            .Distinct()
            .OrderBy(t => t)
            .ToListAsync();

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
