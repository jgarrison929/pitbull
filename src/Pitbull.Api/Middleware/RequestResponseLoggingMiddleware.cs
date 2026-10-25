using System.Text;
using System.Text.Json;
using Pitbull.Core.Logging;

namespace Pitbull.Api.Middleware;

public class RequestResponseLoggingMiddleware(RequestDelegate next, ILogger<RequestResponseLoggingMiddleware> logger)
{
    /// <summary>
    /// JSON property / header name fragments treated as secrets (case-insensitive contains match).
    /// Includes email so login/register addresses are not written to sinks.
    /// </summary>
    private static readonly string[] SensitiveFields =
    {
        "password", "token", "secret", "key", "email", "cookie", "authorization", "bearer"
    };

    private static readonly HashSet<string> SensitiveHeaderNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "Authorization",
        "Cookie",
        "Set-Cookie",
        "X-Api-Key",
        "X-Auth-Token"
    };

    private const int MaxLoggedBodyChars = 4096;

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = context.Items[CorrelationIdMiddleware.CorrelationIdItemName]?.ToString();

        // Only log for API endpoints (not static files, health checks, etc.)
        if (!context.Request.Path.StartsWithSegments("/api"))
        {
            await next(context);
            return;
        }

        // Full body/headers only in Development. When IHostEnvironment is missing
        // (unit tests with empty RequestServices), include details so redaction is exercised.
        var env = context.RequestServices?.GetService(typeof(IHostEnvironment)) as IHostEnvironment;
        var includeDetails = env is null || env.IsDevelopment();

        await LogRequestAsync(context, correlationId, includeDetails);

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
            logger.LogError(ex, "Request failed with exception. CorrelationId: {CorrelationId}",
                LogSafe.Text(correlationId));
            throw;
        }
        finally
        {
            // Log response for errors (body only when details enabled)
            if (context.Response.StatusCode >= 400)
            {
                await LogResponseAsync(context, correlationId, includeDetails);
            }

            // Copy response back to original stream
            responseBodyStream.Seek(0, SeekOrigin.Begin);
            await responseBodyStream.CopyToAsync(originalResponseBodyStream);
            context.Response.Body = originalResponseBodyStream;
        }
    }

    private async Task LogRequestAsync(HttpContext context, string? correlationId, bool includeDetails)
    {
        var request = context.Request;
        var safePath = SanitizePath(request.Path);
        var safeQuery = SanitizeQueryString(request.QueryString.ToString());

        if (!includeDetails)
        {
            logger.LogInformation(
                "API Request. CorrelationId: {CorrelationId}, Method: {Method}, Path: {Path}, Query: {Query}",
                LogSafe.Text(correlationId),
                LogSafe.Text(request.Method),
                LogSafe.Text(safePath),
                LogSafe.Text(safeQuery));
            return;
        }

        var logData = new
        {
            Method = LogSafe.Text(request.Method),
            Path = LogSafe.Text(safePath),
            QueryString = LogSafe.Text(safeQuery),
            Headers = GetSafeHeaders(request.Headers),
            Body = await GetSafeRequestBodyAsync(request)
        };

        logger.LogInformation(
            "API Request. CorrelationId: {CorrelationId}, Request: {@Request}",
            LogSafe.Text(correlationId),
            logData);
    }

    private async Task LogResponseAsync(HttpContext context, string? correlationId, bool includeBody)
    {
        string? safeBody = null;
        if (includeBody)
        {
            context.Response.Body.Seek(0, SeekOrigin.Begin);
            var responseBody = await new StreamReader(context.Response.Body).ReadToEndAsync();
            context.Response.Body.Seek(0, SeekOrigin.Begin);
            safeBody = SanitizeJsonBody(responseBody);
        }

        var logData = new
        {
            StatusCode = context.Response.StatusCode,
            Headers = includeBody ? GetSafeHeaders(context.Response.Headers) : null,
            Body = safeBody
        };

        logger.LogWarning(
            "API Error Response. CorrelationId: {CorrelationId}, Response: {@Response}",
            LogSafe.Text(correlationId),
            logData);
    }

    /// <summary>
    /// Redact secret path segments (vendor-portal tokens, invitation tokens) before logging.
    /// Delegates to <see cref="RequestLogSanitizer"/> (shared with Core middleware and diagnostics).
    /// </summary>
    internal static string SanitizePath(PathString path)
        => RequestLogSanitizer.SanitizePath(path.Value);

    /// <summary>
    /// Sanitize a raw request path (optionally including <c>?query</c>) for Serilog request logging
    /// and other completion events. Delegates to <see cref="RequestLogSanitizer"/>.
    /// </summary>
    internal static string SanitizeRequestPathForLogging(string? requestPath)
        => RequestLogSanitizer.SanitizeRequestPathForLogging(requestPath);

    /// <summary>
    /// Redact query values whose keys look sensitive; always run through LogSafe for CR/LF.
    /// </summary>
    internal static string SanitizeQueryString(string? query)
        => RequestLogSanitizer.SanitizeQueryString(query);

    private async Task<string?> GetSafeRequestBodyAsync(HttpRequest request)
    {
        if (request.Body == null || !request.Body.CanRead)
            return null;

        if (!request.ContentType?.Contains("application/json") == true)
            return LogSafe.Text($"[{request.ContentType}]");

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
            var serialized = JsonSerializer.Serialize(sanitized);
            if (serialized.Length > MaxLoggedBodyChars)
                return LogSafe.Text(serialized[..MaxLoggedBodyChars]) + "…[truncated]";
            return LogSafe.Text(serialized);
        }
        catch
        {
            // If JSON parsing fails, check for sensitive fields in raw text
            var sanitized = jsonBody;
            foreach (var field in SensitiveFields)
            {
                if (sanitized.Contains($"\"{field}\"", StringComparison.OrdinalIgnoreCase))
                {
                    return $"[Contains sensitive field: {field}]";
                }
            }

            if (sanitized.Length > MaxLoggedBodyChars)
                sanitized = sanitized[..MaxLoggedBodyChars] + "…[truncated]";
            return LogSafe.Text(sanitized);
        }
    }

    private object SanitizeJsonElement(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.Object => SanitizeJsonObject(element),
            JsonValueKind.Array => element.EnumerateArray().Select(SanitizeJsonElement).ToArray(),
            JsonValueKind.String => LogSafe.Text(element.GetString()),
            JsonValueKind.Number => element.GetRawText(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Null => null!,
            _ => LogSafe.Text(element.GetRawText())
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

    private static Dictionary<string, string> GetSafeHeaders(IHeaderDictionary headers)
    {
        var result = new Dictionary<string, string>();
        foreach (var header in headers)
        {
            var key = header.Key;
            var isSensitive = SensitiveHeaderNames.Contains(key)
                             || SensitiveFields.Any(field => key.Contains(field, StringComparison.OrdinalIgnoreCase));

            result[key] = isSensitive ? "[REDACTED]" : LogSafe.Text(header.Value.ToString());
        }
        return result;
    }
}
