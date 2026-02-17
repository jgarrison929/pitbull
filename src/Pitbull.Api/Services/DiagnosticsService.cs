using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Services;

public interface IDiagnosticsService
{
    Task<DiagnosticErrorListResult> ListAsync(DiagnosticErrorFilter filter, CancellationToken ct = default);
    Task<DiagnosticError?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<DiagnosticError> CreateAsync(CreateDiagnosticErrorRequest request, CancellationToken ct = default);
    Task<DiagnosticError?> AcknowledgeAsync(Guid id, string acknowledgedBy, string? resolution, CancellationToken ct = default);
    Task<DiagnosticErrorSummary> GetSummaryAsync(CancellationToken ct = default);
}

public class DiagnosticsService(PitbullDbContext db) : IDiagnosticsService
{
    public async Task<DiagnosticErrorListResult> ListAsync(DiagnosticErrorFilter filter, CancellationToken ct = default)
    {
        var query = db.Set<DiagnosticError>().AsNoTracking().AsQueryable();

        if (!string.IsNullOrEmpty(filter.Source))
            query = query.Where(e => e.Source == filter.Source);

        if (!string.IsNullOrEmpty(filter.Level))
            query = query.Where(e => e.Level == filter.Level);

        if (filter.Acknowledged.HasValue)
            query = query.Where(e => e.Acknowledged == filter.Acknowledged.Value);

        if (filter.Since.HasValue)
            query = query.Where(e => e.Timestamp >= filter.Since.Value);

        if (filter.Until.HasValue)
            query = query.Where(e => e.Timestamp <= filter.Until.Value);

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(e => e.Timestamp)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync(ct);

        return new DiagnosticErrorListResult(items, totalCount, filter.Page, filter.PageSize);
    }

    public async Task<DiagnosticError?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await db.Set<DiagnosticError>()
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == id, ct);
    }

    public async Task<DiagnosticError> CreateAsync(CreateDiagnosticErrorRequest request, CancellationToken ct = default)
    {
        var error = new DiagnosticError
        {
            Source = request.Source,
            Level = request.Level ?? "error",
            HttpStatusCode = request.HttpStatusCode,
            RequestMethod = request.RequestMethod,
            RequestPath = request.RequestPath,
            QueryString = request.QueryString,
            Message = request.Message,
            ExceptionType = request.ExceptionType,
            StackTrace = request.StackTrace,
            TenantId = request.TenantId,
            UserId = request.UserId,
            UserEmail = request.UserEmail,
            CorrelationId = request.CorrelationId,
            TraceId = request.TraceId,
            UserAgent = request.UserAgent,
            IpAddress = request.IpAddress,
            ComponentStack = request.ComponentStack,
            BrowserInfo = request.BrowserInfo,
            PageUrl = request.PageUrl,
            Metadata = request.Metadata
        };

        db.Set<DiagnosticError>().Add(error);
        await db.SaveChangesAsync(ct);

        return error;
    }

    public async Task<DiagnosticError?> AcknowledgeAsync(Guid id, string acknowledgedBy, string? resolution, CancellationToken ct = default)
    {
        var error = await db.Set<DiagnosticError>()
            .FirstOrDefaultAsync(e => e.Id == id, ct);

        if (error is null) return null;

        error.Acknowledged = true;
        error.AcknowledgedAt = DateTime.UtcNow;
        error.AcknowledgedBy = acknowledgedBy;
        error.Resolution = resolution;

        await db.SaveChangesAsync(ct);
        return error;
    }

    public async Task<DiagnosticErrorSummary> GetSummaryAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var last24h = now.AddHours(-24);
        var last7d = now.AddDays(-7);
        var last30d = now.AddDays(-30);

        var errors = await db.Set<DiagnosticError>()
            .AsNoTracking()
            .Where(e => e.Timestamp >= last30d)
            .Select(e => new { e.Timestamp, e.Source, e.Level, e.Acknowledged })
            .ToListAsync(ct);

        return new DiagnosticErrorSummary(
            Last24Hours: BuildPeriodSummary(errors.Where(e => e.Timestamp >= last24h)),
            Last7Days: BuildPeriodSummary(errors.Where(e => e.Timestamp >= last7d)),
            Last30Days: BuildPeriodSummary(errors),
            UnacknowledgedCount: errors.Count(e => !e.Acknowledged)
        );
    }

    private static DiagnosticPeriodSummary BuildPeriodSummary(IEnumerable<dynamic> errors)
    {
        var list = errors.ToList();
        return new DiagnosticPeriodSummary(
            Total: list.Count,
            BySource: list.GroupBy(e => (string)e.Source).ToDictionary(g => g.Key, g => g.Count()),
            ByLevel: list.GroupBy(e => (string)e.Level).ToDictionary(g => g.Key, g => g.Count())
        );
    }
}

// --- DTOs ---

public record DiagnosticErrorFilter(
    string? Source = null,
    string? Level = null,
    bool? Acknowledged = null,
    DateTime? Since = null,
    DateTime? Until = null,
    int Page = 1,
    int PageSize = 50
);

public record DiagnosticErrorListResult(
    List<DiagnosticError> Items,
    int TotalCount,
    int Page,
    int PageSize
);

public record CreateDiagnosticErrorRequest
{
    public string Source { get; init; } = string.Empty;
    public string? Level { get; init; }
    public int? HttpStatusCode { get; init; }
    public string? RequestMethod { get; init; }
    public string? RequestPath { get; init; }
    public string? QueryString { get; init; }
    public string Message { get; init; } = string.Empty;
    public string? ExceptionType { get; init; }
    public string? StackTrace { get; init; }
    public Guid? TenantId { get; init; }
    public string? UserId { get; init; }
    public string? UserEmail { get; init; }
    public string? CorrelationId { get; init; }
    public string? TraceId { get; init; }
    public string? UserAgent { get; init; }
    public string? IpAddress { get; init; }
    public string? ComponentStack { get; init; }
    public string? BrowserInfo { get; init; }
    public string? PageUrl { get; init; }
    public string? Metadata { get; init; }
}

public record AcknowledgeRequest
{
    public string? Resolution { get; init; }
}

public record DiagnosticErrorSummary(
    DiagnosticPeriodSummary Last24Hours,
    DiagnosticPeriodSummary Last7Days,
    DiagnosticPeriodSummary Last30Days,
    int UnacknowledgedCount
);

public record DiagnosticPeriodSummary(
    int Total,
    Dictionary<string, int> BySource,
    Dictionary<string, int> ByLevel
);
