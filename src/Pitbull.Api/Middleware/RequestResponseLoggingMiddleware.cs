using System.Text;
using System.Text.Json;

namespace Pitbull.Api.Middleware;

public class RequestResponseLoggingMiddleware(RequestDelegate next, ILogger<RequestResponseLoggingMiddleware> logger)
{
    private static readonly string[] SensitiveFields = { "password", "token", "secret", "key" };

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = context.Items[CorrelationIdMiddleware.CorrelationIdItemName]?.ToString();
        
        // Only log for API endpoints (not static files, health checks, etc.)
        if (!context.Request.Path.StartsWithSegments("/api"))
        {
            await next(context);
            return;
        }

        // Log request details
        await LogRequestAsync(context, correlationId);

        // Capture response for error logging
        var originalResponseBodyStream = context.Response.Body;
        using var responseBodyStream = new MemoryStream();
        context.Response.Body = responseBodyStream;

        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Request failed with exception. CorrelationId: {CorrelationId}", correlationId);
            throw;
        }
        finally
        {
            // Log response for errors or when explicitly requested
            if (context.Response.StatusCode >= 400)
            {
                await LogResponseAsync(context, correlationId);
            }

            // Copy response back to original stream
            responseBodyStream.Seek(0, SeekOrigin.Begin);
            await responseBodyStream.CopyToAsync(originalResponseBodyStream);
            context.Response.Body = originalResponseBodyStream;
        }
    }

    private async Task LogRequestAsync(HttpContext context, string? correlationId)
    {
        var request = context.Request;
        var logData = new
        {
            Method = request.Method,
            Path = request.Path,
            QueryString = request.QueryString.ToString(),
            Headers = GetSafeHeaders(request.Headers),
            Body = await GetSafeRequestBodyAsync(request)
        };

        logger.LogInformation("API Request. CorrelationId: {CorrelationId}, Request: {@Request}", correlationId, logData);
    }

    private async Task LogResponseAsync(HttpContext context, string? correlationId)
    {
        context.Response.Body.Seek(0, SeekOrigin.Begin);
        var responseBody = await new StreamReader(context.Response.Body).ReadToEndAsync();
        context.Response.Body.Seek(0, SeekOrigin.Begin);

        var logData = new
        {
            StatusCode = context.Response.StatusCode,
            Headers = GetSafeHeaders(context.Response.Headers),
            Body = responseBody
        };

        logger.LogWarning("API Error Response. CorrelationId: {CorrelationId}, Response: {@Response}", correlationId, logData);
    }

    private async Task<string?> GetSafeRequestBodyAsync(HttpRequest request)
    {
        if (request.Body == null || !request.Body.CanRead)
            return null;

        if (!request.ContentType?.Contains("application/json") == true)
            return $"[{request.ContentType}]";

        try
        {
            request.EnableBuffering();
            var body = await new StreamReader(request.Body, Encoding.UTF8).ReadToEndAsync();
            request.Body.Position = 0;

            return SanitizeJsonBody(body);
        }
        catch
        {
            return "[Unable to read body]";
        }
    }

    private string? SanitizeJsonBody(string jsonBody)
    {
        if (string.IsNullOrWhiteSpace(jsonBody))
            return null;

        try
        {
            var json = JsonDocument.Parse(jsonBody);
            var sanitized = SanitizeJsonElement(json.RootElement);
            return JsonSerializer.Serialize(sanitized);
        }
        catch
        {
            // If JSON parsing fails, check for sensitive fields in raw text
            var sanitized = jsonBody;
            foreach (var field in SensitiveFields)
            {
                if (sanitized.Contains($"\"{field}\"", StringComparison.OrdinalIgnoreCase))
                {
                    sanitized = $"[Contains sensitive field: {field}]";
                    break;
                }
            }
            return sanitized;
        }
    }

    private object SanitizeJsonElement(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.Object => SanitizeJsonObject(element),
            JsonValueKind.Array => element.EnumerateArray().Select(SanitizeJsonElement).ToArray(),
            _ => element.GetRawText()
        };
    }

    private Dictionary<string, object> SanitizeJsonObject(JsonElement obj)
    {
        var result = new Dictionary<string, object>();
        foreach (var property in obj.EnumerateObject())
        {
            var key = property.Name;
            var isSensitive = SensitiveFields.Any(field => key.Contains(field, StringComparison.OrdinalIgnoreCase));
            
            result[key] = isSensitive ? "[REDACTED]" : SanitizeJsonElement(property.Value);
        }
        return result;
    }

    private Dictionary<string, string> GetSafeHeaders(IHeaderDictionary headers)
    {
        var result = new Dictionary<string, string>();
        foreach (var header in headers)
        {
            var key = header.Key;
            var isSensitive = SensitiveFields.Any(field => key.Contains(field, StringComparison.OrdinalIgnoreCase)) 
                             || key.Equals("Authorization", StringComparison.OrdinalIgnoreCase);
            
            result[key] = isSensitive ? "[REDACTED]" : header.Value.ToString();
        }
        return result;
    }
}