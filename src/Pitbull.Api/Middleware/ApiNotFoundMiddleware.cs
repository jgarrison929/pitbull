using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Middleware;

/// <summary>
/// Captures 404 responses on /api/ routes as diagnostic errors.
/// Registered AFTER endpoint routing so it only fires for unmatched API routes,
/// not for static file 404s or frontend routes.
/// </summary>
public class ApiNotFoundMiddleware(RequestDelegate next, ILogger<ApiNotFoundMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        await next(context);

        if (context.Response.StatusCode == 404
            && context.Request.Path.StartsWithSegments("/api")
            && !context.Response.HasStarted)
        {
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
                        IpAddress = context.Connection.RemoteIpAddress?.ToString()
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
}
