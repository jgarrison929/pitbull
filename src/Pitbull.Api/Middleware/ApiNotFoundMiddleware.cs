using System.Collections.Concurrent;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Middleware;

/// <summary>
/// Captures 404 responses on /api/ routes as diagnostic errors.
/// Registered AFTER endpoint routing so it only fires for unmatched API routes,
/// not for static file 404s or frontend routes.
/// Rate-limited per IP to prevent database flooding from path-scan attacks.
/// </summary>
public class ApiNotFoundMiddleware(RequestDelegate next, ILogger<ApiNotFoundMiddleware> logger)
{
    private const int MaxEntriesPerWindow = 10;
    private static readonly TimeSpan Window = TimeSpan.FromMinutes(1);

    // IP → (count, windowStart). Lightweight — no DI needed.
    private static readonly ConcurrentDictionary<string, (int Count, DateTime WindowStart)> _ipCounters = new();

    public async Task InvokeAsync(HttpContext context)
    {
        await next(context);

        if (context.Response.StatusCode == 404
            && context.Request.Path.StartsWithSegments("/api")
            && !context.Response.HasStarted)
        {
            var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            if (!TryConsume(ip))
            {
                logger.LogDebug("API 404 logging rate limit exceeded for {IpAddress}", ip);
                return;
            }

            try
            {
                var dbContext = context.RequestServices.GetService<PitbullDbContext>();
                if (dbContext != null)
                {
                    var traceId = context.TraceIdentifier;
                    var correlationId = context.Items.TryGetValue(CorrelationIdMiddleware.CorrelationIdItemName, out var cid)
                        ? cid?.ToString()
                        : null;

                    var tenantIdClaim = context.User?.FindFirst("tenant_id")?.Value;
                    Guid? tenantId = Guid.TryParse(tenantIdClaim, out var tid) ? tid : null;

                    var diagnosticError = new DiagnosticError
                    {
                        Source = "backend",
                        Level = "warning",
                        HttpStatusCode = 404,
                        RequestMethod = context.Request.Method,
                        RequestPath = context.Request.Path,
                        QueryString = context.Request.QueryString.ToString(),
                        Message = $"API 404: {context.Request.Method} {context.Request.Path}",
                        TenantId = tenantId,
                        UserId = context.User?.FindFirst("sub")?.Value,
                        UserEmail = context.User?.FindFirst("email")?.Value,
                        CorrelationId = correlationId,
                        TraceId = traceId,
                        UserAgent = context.Request.Headers.UserAgent.ToString(),
                        IpAddress = ip
                    };

                    dbContext.Set<DiagnosticError>().Add(diagnosticError);
                    await dbContext.SaveChangesAsync();
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to save API 404 diagnostic error");
            }
        }
    }

    /// <summary>
    /// Sliding-window rate limiter: allows <see cref="MaxEntriesPerWindow"/> 404 logs per IP per minute.
    /// </summary>
    private static bool TryConsume(string ip)
    {
        var now = DateTime.UtcNow;
        var entry = _ipCounters.AddOrUpdate(
            ip,
            _ => (1, now),
            (_, existing) =>
            {
                if (now - existing.WindowStart > Window)
                    return (1, now); // Reset window
                return (existing.Count + 1, existing.WindowStart);
            });

        return entry.Count <= MaxEntriesPerWindow;
    }
}
