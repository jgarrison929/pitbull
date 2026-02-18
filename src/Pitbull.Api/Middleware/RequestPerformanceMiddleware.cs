using System.Diagnostics;
using Pitbull.Api.Infrastructure;
using PostHog;

namespace Pitbull.Api.Middleware;

/// <summary>
/// Tracks per-request performance and sends events to PostHog for:
/// - Slow requests (>2 seconds)
/// - N+1 query detection (>20 queries in a single request)
///
/// Only captures events for problematic requests to avoid excessive event volume.
/// Works cooperatively with PostHogDbInterceptor which tracks query count in HttpContext.Items.
/// </summary>
public class RequestPerformanceMiddleware(
    RequestDelegate next,
    ILogger<RequestPerformanceMiddleware> logger,
    IPostHogClient? posthog = null)
{
    private const int SlowRequestThresholdMs = 2000;
    private const int N1QueryThreshold = 20;

    public async Task InvokeAsync(HttpContext context)
    {
        var sw = Stopwatch.StartNew();

        await next(context);

        sw.Stop();
        var durationMs = sw.Elapsed.TotalMilliseconds;
        var queryCount = GetQueryCount(context);
        var endpoint = GetEndpoint(context);

        // Only capture to PostHog for problematic requests
        if (posthog is null) return;

        try
        {
            if (durationMs > SlowRequestThresholdMs)
            {
                posthog.Capture(
                    "pitbull-api",
                    "slow_request",
                    new Dictionary<string, object>
                    {
                        ["endpoint"] = endpoint,
                        ["method"] = context.Request.Method,
                        ["duration_ms"] = Math.Round(durationMs, 1),
                        ["query_count"] = queryCount,
                        ["status_code"] = context.Response.StatusCode,
                        ["threshold_ms"] = SlowRequestThresholdMs
                    });
            }

            if (queryCount > N1QueryThreshold)
            {
                posthog.Capture(
                    "pitbull-api",
                    "n_plus_one_detected",
                    new Dictionary<string, object>
                    {
                        ["endpoint"] = endpoint,
                        ["method"] = context.Request.Method,
                        ["query_count"] = queryCount,
                        ["duration_ms"] = Math.Round(durationMs, 1),
                        ["status_code"] = context.Response.StatusCode,
                        ["threshold"] = N1QueryThreshold
                    });

                logger.LogWarning(
                    "Potential N+1 detected: {QueryCount} queries for {Method} {Endpoint} ({DurationMs}ms)",
                    queryCount, context.Request.Method, endpoint, Math.Round(durationMs, 1));
            }
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Failed to capture request performance event to PostHog");
        }
    }

    private static int GetQueryCount(HttpContext context)
    {
        return context.Items.TryGetValue(PostHogDbInterceptor.QueryCountKey, out var count)
            ? (int)count!
            : 0;
    }

    private static string GetEndpoint(HttpContext context)
    {
        var endpoint = context.GetEndpoint();
        if (endpoint is not null)
            return endpoint.DisplayName ?? context.Request.Path.Value ?? "unknown";

        return $"{context.Request.Method} {context.Request.Path.Value}";
    }
}
