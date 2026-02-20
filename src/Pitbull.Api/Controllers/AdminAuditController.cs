using System.Globalization;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Admin audit log viewer - immutable record of all system activity
/// with change diff tracking and CSV export.
/// </summary>
[ApiController]
[Route("api/admin/audit-logs")]
[Authorize(Policy = "SystemAdmin.AuditLogs")]
[EnableRateLimiting("api")]
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
        [FromQuery] string? action,
        [FromQuery] string? resourceType,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] bool? success,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        [FromQuery] string sortBy = "timestamp",
        [FromQuery] string sortDir = "desc")
    {
        var query = db.Set<AuditLog>().AsNoTracking().AsQueryable();

        if (userId.HasValue)
            query = query.Where(a => a.UserId == userId);
        if (!string.IsNullOrEmpty(action) && Enum.TryParse<AuditAction>(action, true, out var parsedAction))
            query = query.Where(a => a.Action == parsedAction);
        if (!string.IsNullOrEmpty(resourceType))
            query = query.Where(a => a.ResourceType == resourceType);
        if (from.HasValue)
            query = query.Where(a => a.Timestamp >= from.Value.Date);
        if (to.HasValue)
            query = query.Where(a => a.Timestamp < to.Value.Date.AddDays(1));
        if (success.HasValue)
            query = query.Where(a => a.Success == success);
        if (!string.IsNullOrEmpty(search))
            query = query.Where(a =>
                (a.Description != null && a.Description.Contains(search)) ||
                (a.UserEmail != null && a.UserEmail.Contains(search)) ||
                (a.UserName != null && a.UserName.Contains(search)) ||
                (a.ResourceId != null && a.ResourceId.Contains(search)));

        var totalCount = await query.CountAsync();

        // Sorting
        query = sortBy.ToLowerInvariant() switch
        {
            "user" => sortDir == "asc"
                ? query.OrderBy(a => a.UserName)
                : query.OrderByDescending(a => a.UserName),
            "action" => sortDir == "asc"
                ? query.OrderBy(a => a.Action)
                : query.OrderByDescending(a => a.Action),
            "resourcetype" => sortDir == "asc"
                ? query.OrderBy(a => a.ResourceType)
                : query.OrderByDescending(a => a.ResourceType),
            _ => sortDir == "asc"
                ? query.OrderBy(a => a.Timestamp)
                : query.OrderByDescending(a => a.Timestamp),
        };

        pageSize = Math.Clamp(pageSize, 1, 100);
        var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        var items = await query
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
                Changes = a.Changes,
                Metadata = a.Metadata,
                IpAddress = a.IpAddress,
                UserAgent = a.UserAgent,
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
    /// Get a single audit log entry with full change diff
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(AuditLogDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetLog(Guid id)
    {
        var log = await db.Set<AuditLog>()
            .AsNoTracking()
            .Where(a => a.Id == id)
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
                Changes = a.Changes,
                Metadata = a.Metadata,
                IpAddress = a.IpAddress,
                UserAgent = a.UserAgent,
                Timestamp = a.Timestamp,
                Success = a.Success,
                ErrorMessage = a.ErrorMessage
            })
            .FirstOrDefaultAsync();

        if (log == null)
            return NotFound(new { error = "Audit log not found", code = "NOT_FOUND" });

        return Ok(log);
    }

    /// <summary>
    /// Get audit log summary: counts by action, top users, recent activity
    /// </summary>
    [HttpGet("summary")]
    [ProducesResponseType(typeof(AuditLogSummaryResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSummary()
    {
        var today = DateTime.UtcNow.Date;
        var todayEnd = today.AddDays(1);

        var baseQuery = db.Set<AuditLog>().AsNoTracking();

        // Counts by action type (today)
        var actionCounts = await baseQuery
            .Where(a => a.Timestamp >= today && a.Timestamp < todayEnd)
            .GroupBy(a => a.Action)
            .Select(g => new ActionCountDto { Action = g.Key.ToString(), Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .ToListAsync();

        // Total events today
        var totalToday = actionCounts.Sum(x => x.Count);

        // Most active user today
        var topUser = await baseQuery
            .Where(a => a.Timestamp >= today && a.Timestamp < todayEnd && a.UserId != null)
            .GroupBy(a => new { a.UserId, a.UserName, a.UserEmail })
            .Select(g => new TopUserDto
            {
                UserId = g.Key.UserId,
                UserName = g.Key.UserName,
                UserEmail = g.Key.UserEmail,
                EventCount = g.Count()
            })
            .OrderByDescending(x => x.EventCount)
            .FirstOrDefaultAsync();

        // Most changed entity type today
        var topEntityType = await baseQuery
            .Where(a => a.Timestamp >= today && a.Timestamp < todayEnd)
            .GroupBy(a => a.ResourceType)
            .Select(g => new { ResourceType = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .FirstOrDefaultAsync();

        // Login count today
        var loginCount = await baseQuery
            .Where(a => a.Timestamp >= today && a.Timestamp < todayEnd && a.Action == AuditAction.Login)
            .CountAsync();

        // Recent activity (last 10)
        var recentActivity = await baseQuery
            .OrderByDescending(a => a.Timestamp)
            .Take(10)
            .Select(a => new RecentActivityDto
            {
                Id = a.Id,
                Action = a.Action.ToString(),
                ResourceType = a.ResourceType,
                ResourceId = a.ResourceId,
                Description = a.Description,
                UserName = a.UserName,
                Timestamp = a.Timestamp
            })
            .ToListAsync();

        return Ok(new AuditLogSummaryResponse
        {
            TotalEventsToday = totalToday,
            ActionCounts = actionCounts,
            TopUser = topUser,
            TopEntityType = topEntityType?.ResourceType,
            TopEntityTypeCount = topEntityType?.Count ?? 0,
            LoginCountToday = loginCount,
            RecentActivity = recentActivity
        });
    }

    /// <summary>
    /// Export filtered audit logs as CSV
    /// </summary>
    [HttpGet("export")]
    [Produces("text/csv")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> ExportCsv(
        [FromQuery] Guid? userId,
        [FromQuery] string? action,
        [FromQuery] string? resourceType,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to)
    {
        var query = db.Set<AuditLog>().AsNoTracking().AsQueryable();

        if (userId.HasValue)
            query = query.Where(a => a.UserId == userId);
        if (!string.IsNullOrEmpty(action) && Enum.TryParse<AuditAction>(action, true, out var parsedAction))
            query = query.Where(a => a.Action == parsedAction);
        if (!string.IsNullOrEmpty(resourceType))
            query = query.Where(a => a.ResourceType == resourceType);
        if (from.HasValue)
            query = query.Where(a => a.Timestamp >= from.Value.Date);
        if (to.HasValue)
            query = query.Where(a => a.Timestamp < to.Value.Date.AddDays(1));

        // Cap at 10,000 rows for export
        var logs = await query
            .OrderByDescending(a => a.Timestamp)
            .Take(10000)
            .Select(a => new
            {
                a.Timestamp,
                UserName = a.UserName ?? "",
                UserEmail = a.UserEmail ?? "",
                Action = a.Action.ToString(),
                a.ResourceType,
                ResourceId = a.ResourceId ?? "",
                a.Description,
                IpAddress = a.IpAddress ?? "",
                a.Success
            })
            .ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine("Timestamp,User,Email,Action,Resource Type,Resource ID,Description,IP Address,Success");

        foreach (var log in logs)
        {
            sb.AppendLine(string.Join(",",
                CsvEscape(log.Timestamp.ToString("O", CultureInfo.InvariantCulture)),
                CsvEscape(log.UserName),
                CsvEscape(log.UserEmail),
                CsvEscape(log.Action),
                CsvEscape(log.ResourceType),
                CsvEscape(log.ResourceId),
                CsvEscape(log.Description),
                CsvEscape(log.IpAddress),
                log.Success.ToString()));
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        var fileName = $"audit-logs-{DateTime.UtcNow:yyyy-MM-dd}.csv";
        return File(bytes, "text/csv", fileName);
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

    private static string CsvEscape(string value)
    {
        if (string.IsNullOrEmpty(value)) return "";
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n'))
            return $"\"{value.Replace("\"", "\"\"")}\"";
        return value;
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
    public string? Changes { get; init; }
    public string? Metadata { get; init; }
    public string? IpAddress { get; init; }
    public string? UserAgent { get; init; }
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

public record AuditLogSummaryResponse
{
    public int TotalEventsToday { get; init; }
    public List<ActionCountDto> ActionCounts { get; init; } = [];
    public TopUserDto? TopUser { get; init; }
    public string? TopEntityType { get; init; }
    public int TopEntityTypeCount { get; init; }
    public int LoginCountToday { get; init; }
    public List<RecentActivityDto> RecentActivity { get; init; } = [];
}

public record ActionCountDto
{
    public string Action { get; init; } = string.Empty;
    public int Count { get; init; }
}

public record TopUserDto
{
    public Guid? UserId { get; init; }
    public string? UserName { get; init; }
    public string? UserEmail { get; init; }
    public int EventCount { get; init; }
}

public record RecentActivityDto
{
    public Guid Id { get; init; }
    public string Action { get; init; } = string.Empty;
    public string ResourceType { get; init; } = string.Empty;
    public string? ResourceId { get; init; }
    public string Description { get; init; } = string.Empty;
    public string? UserName { get; init; }
    public DateTime Timestamp { get; init; }
}
