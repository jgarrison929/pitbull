using System.Net;
using System.Text.Json;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using PostHog;
using Pitbull.Core.Logging;

namespace Pitbull.Api.Middleware;

public class ExceptionMiddleware(
    RequestDelegate next,
    ILogger<ExceptionMiddleware> logger,
    IHostEnvironment env,
    IPostHogClient? posthog = null)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            var traceId = context.TraceIdentifier;
            var correlationId = context.Items.TryGetValue(CorrelationIdMiddleware.CorrelationIdItemName, out var cid)
                ? cid?.ToString()
                : context.Request.Headers[CorrelationIdMiddleware.CorrelationIdHeaderName].FirstOrDefault();

            logger.LogError(ex, "Unhandled exception. TraceId: {TraceId} CorrelationId: {CorrelationId}", LogSafe.Text(traceId), LogSafe.Text(correlationId));

            // Save diagnostic error to database using a fresh scope to avoid
            // re-saving failed entities from the request's DbContext.
            try
            {
                var scopeFactory = context.RequestServices.GetService<IServiceScopeFactory>();
                if (scopeFactory != null)
                {
                    await using var scope = scopeFactory.CreateAsyncScope();
                    var dbContext = scope.ServiceProvider.GetRequiredService<PitbullDbContext>();

                    var tenantIdClaim = context.User?.FindFirst("tenant_id")?.Value;
                    Guid? tenantId = Guid.TryParse(tenantIdClaim, out var tid) ? tid : null;

                    var diagnosticError = new DiagnosticError
                    {
                        Source = "backend",
                        Level = "error",
                        HttpStatusCode = 500,
                        RequestMethod = context.Request.Method,
                        RequestPath = context.Request.Path,
                        QueryString = context.Request.QueryString.ToString(),
                        Message = ex.Message,
                        ExceptionType = ex.GetType().FullName,
                        StackTrace = ex.ToString(),
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
            catch (Exception saveEx)
            {
                logger.LogWarning(saveEx, "Failed to save diagnostic error to database");
            }

            // Send to PostHog Error Tracking (fire-and-forget)
            try
            {
                var exceptionString = ex.ToString();
                posthog?.Capture(
                    "pitbull-api",
                    "$exception",
                    new Dictionary<string, object>
                    {
                        ["$exception_type"] = ex.GetType().Name,
                        ["$exception_message"] = ex.Message,
                        ["$exception_stack_trace_raw"] = exceptionString[..Math.Min(8000, exceptionString.Length)],
                        ["$exception_source"] = "dotnet_middleware",
                        ["endpoint"] = context.Request.Path.Value ?? "unknown",
                        ["method"] = context.Request.Method,
                        ["status_code"] = 500,
                    });
            }
            catch (Exception phEx)
            {
                logger.LogDebug(phEx, "Failed to capture server error event to PostHog");
            }

            context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
            context.Response.ContentType = "application/json";

            var response = new Dictionary<string, object?>
            {
                ["error"] = "An unexpected error occurred",
                ["traceId"] = traceId,
                ["correlationId"] = correlationId
            };

            if (env.IsDevelopment())
            {
                response["exception"] = ex.ToString();
            }

            var json = JsonSerializer.Serialize(response, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            await context.Response.WriteAsync(json);
        }
    }
}
