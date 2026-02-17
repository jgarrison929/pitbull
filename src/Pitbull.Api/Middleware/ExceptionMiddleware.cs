using System.Net;
using System.Text.Json;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Middleware;

public class ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger, IHostEnvironment env)
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

            logger.LogError(ex, "Unhandled exception. TraceId: {TraceId} CorrelationId: {CorrelationId}", traceId, correlationId);

            // Save diagnostic error to database (must not affect the error response)
            try
            {
                var dbContext = context.RequestServices.GetService<PitbullDbContext>();
                if (dbContext != null)
                {
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
