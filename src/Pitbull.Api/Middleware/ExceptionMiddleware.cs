using System.Net;
using System.Text.Json;

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
