using Pitbull.Api.Services;
using System.Diagnostics;

namespace Pitbull.Api.Middleware;

/// <summary>
/// Tracks lightweight in-memory request counts and latencies for health dashboards.
/// </summary>
public sealed class RequestMetricsMiddleware(
    RequestDelegate next,
    IRequestMetricsStore metricsStore)
{
    public async Task Invoke(HttpContext context)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            await next(context);
        }
        finally
        {
            stopwatch.Stop();
            metricsStore.RecordRequest(stopwatch.Elapsed, context.Response.StatusCode);
        }
    }
}
