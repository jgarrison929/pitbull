using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;
using PostHog;

namespace Pitbull.Api.Infrastructure;

/// <summary>
/// EF Core interceptor that sends database performance events to PostHog:
/// - Slow queries (>500ms)
/// - Failed queries
/// - Per-request query count (for N+1 detection by RequestPerformanceMiddleware)
///
/// All PostHog captures are fire-and-forget. If PostHog is not configured,
/// this interceptor still tracks query counts via HttpContext.Items.
/// </summary>
public class PostHogDbInterceptor(
    IHttpContextAccessor httpContextAccessor,
    ILogger<PostHogDbInterceptor> logger,
    IPostHogClient? posthog = null) : DbCommandInterceptor
{
    private const int SlowQueryThresholdMs = 500;

    /// <summary>
    /// Key used in HttpContext.Items to track per-request query count.
    /// Read by RequestPerformanceMiddleware for N+1 detection.
    /// </summary>
    public const string QueryCountKey = "PostHog.QueryCount";

    public override DbDataReader ReaderExecuted(
        DbCommand command,
        CommandExecutedEventData eventData,
        DbDataReader result)
    {
        TrackQuery(command, eventData);
        return base.ReaderExecuted(command, eventData, result);
    }

    public override ValueTask<DbDataReader> ReaderExecutedAsync(
        DbCommand command,
        CommandExecutedEventData eventData,
        DbDataReader result,
        CancellationToken cancellationToken = default)
    {
        TrackQuery(command, eventData);
        return base.ReaderExecutedAsync(command, eventData, result, cancellationToken);
    }

    public override int NonQueryExecuted(
        DbCommand command,
        CommandExecutedEventData eventData,
        int result)
    {
        TrackQuery(command, eventData);
        return base.NonQueryExecuted(command, eventData, result);
    }

    public override ValueTask<int> NonQueryExecutedAsync(
        DbCommand command,
        CommandExecutedEventData eventData,
        int result,
        CancellationToken cancellationToken = default)
    {
        TrackQuery(command, eventData);
        return base.NonQueryExecutedAsync(command, eventData, result, cancellationToken);
    }

    public override object? ScalarExecuted(
        DbCommand command,
        CommandExecutedEventData eventData,
        object? result)
    {
        TrackQuery(command, eventData);
        return base.ScalarExecuted(command, eventData, result);
    }

    public override ValueTask<object?> ScalarExecutedAsync(
        DbCommand command,
        CommandExecutedEventData eventData,
        object? result,
        CancellationToken cancellationToken = default)
    {
        TrackQuery(command, eventData);
        return base.ScalarExecutedAsync(command, eventData, result, cancellationToken);
    }

    public override void CommandFailed(DbCommand command, CommandErrorEventData eventData)
    {
        CaptureDbError(command, eventData);
        base.CommandFailed(command, eventData);
    }

    public override Task CommandFailedAsync(
        DbCommand command,
        CommandErrorEventData eventData,
        CancellationToken cancellationToken = default)
    {
        CaptureDbError(command, eventData);
        return base.CommandFailedAsync(command, eventData, cancellationToken);
    }

    private void TrackQuery(DbCommand command, CommandExecutedEventData eventData)
    {
        var durationMs = eventData.Duration.TotalMilliseconds;
        IncrementRequestQueryCount();

        if (durationMs > SlowQueryThresholdMs)
        {
            CaptureSlowQuery(command.CommandText, durationMs);
        }
    }

    private void CaptureSlowQuery(string sql, double durationMs)
    {
        if (posthog is null) return;

        try
        {
            var endpoint = GetCurrentEndpoint();
            posthog.Capture(
                "pitbull-api",
                "slow_query",
                new Dictionary<string, object>
                {
                    ["sql"] = TruncateSql(sql),
                    ["duration_ms"] = Math.Round(durationMs, 1),
                    ["endpoint"] = endpoint,
                    ["threshold_ms"] = SlowQueryThresholdMs
                });
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Failed to capture slow query event to PostHog");
        }
    }

    private void CaptureDbError(DbCommand command, CommandErrorEventData eventData)
    {
        if (posthog is null) return;

        try
        {
            var endpoint = GetCurrentEndpoint();
            posthog.Capture(
                "pitbull-api",
                "db_error",
                new Dictionary<string, object>
                {
                    ["sql"] = TruncateSql(command.CommandText),
                    ["error_type"] = eventData.Exception.GetType().Name,
                    ["error_message"] = eventData.Exception.Message,
                    ["endpoint"] = endpoint,
                    ["duration_ms"] = Math.Round(eventData.Duration.TotalMilliseconds, 1)
                });
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Failed to capture db error event to PostHog");
        }
    }

    private void IncrementRequestQueryCount()
    {
        var httpContext = httpContextAccessor.HttpContext;
        if (httpContext is null) return;

        var count = httpContext.Items.TryGetValue(QueryCountKey, out var existing)
            ? (int)existing! + 1
            : 1;

        httpContext.Items[QueryCountKey] = count;
    }

    private string GetCurrentEndpoint()
    {
        var httpContext = httpContextAccessor.HttpContext;
        if (httpContext is null) return "unknown";

        var endpoint = httpContext.GetEndpoint();
        if (endpoint is not null)
            return endpoint.DisplayName ?? httpContext.Request.Path.Value ?? "unknown";

        return $"{httpContext.Request.Method} {httpContext.Request.Path.Value}";
    }

    /// <summary>
    /// Truncate SQL to avoid sending large queries or PII.
    /// Only the parameterized command text is used (parameter values are not included).
    /// </summary>
    private static string TruncateSql(string sql)
    {
        if (string.IsNullOrEmpty(sql)) return "";
        return sql.Length <= 500 ? sql : sql[..500] + "...";
    }
}
