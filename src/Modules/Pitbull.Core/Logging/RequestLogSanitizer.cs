namespace Pitbull.Core.Logging;

/// <summary>
/// Redacts secret path segments and sensitive query values before logging or diagnostic sinks.
/// Shared so Core middleware and Api host layers apply the same rules (vendor-portal / invitation tokens).
/// </summary>
public static class RequestLogSanitizer
{
    /// <summary>
    /// Query key fragments treated as secrets (case-insensitive contains match).
    /// </summary>
    private static readonly string[] SensitiveQueryFields =
    {
        "password", "token", "secret", "key", "email", "cookie", "authorization", "bearer"
    };

    /// <summary>
    /// Redact secret path segments (vendor-portal tokens, invitation tokens) before logging.
    /// </summary>
    public static string SanitizePath(string? pathValue)
    {
        if (string.IsNullOrEmpty(pathValue))
            return string.Empty;

        var segments = pathValue.Split('/', StringSplitOptions.RemoveEmptyEntries);
        for (var i = 0; i < segments.Length; i++)
        {
            // /api/vendor-portal/{token}/... — keep admin "tokens" collection routes
            if (segments[i].Equals("vendor-portal", StringComparison.OrdinalIgnoreCase)
                && i + 1 < segments.Length
                && !segments[i + 1].Equals("tokens", StringComparison.OrdinalIgnoreCase))
            {
                segments[i + 1] = "[REDACTED]";
            }

            // /api/Invitation/token/{token}[/accept]
            if (segments[i].Equals("token", StringComparison.OrdinalIgnoreCase)
                && i + 1 < segments.Length)
            {
                segments[i + 1] = "[REDACTED]";
            }
        }

        return "/" + string.Join('/', segments);
    }

    /// <summary>
    /// Sanitize a raw request path (optionally including <c>?query</c>) for logs, analytics, and diagnostics.
    /// Applies path token redaction + query redaction, then <see cref="LogSafe"/> for CR/LF.
    /// </summary>
    public static string SanitizeRequestPathForLogging(string? requestPath)
    {
        if (string.IsNullOrEmpty(requestPath))
            return string.Empty;

        var pathPart = requestPath;
        string? queryPart = null;
        var q = requestPath.IndexOf('?', StringComparison.Ordinal);
        if (q >= 0)
        {
            pathPart = requestPath[..q];
            queryPart = requestPath[q..];
        }

        var safe = LogSafe.Text(SanitizePath(pathPart));
        if (queryPart is not null)
            safe += SanitizeQueryString(queryPart);
        return safe;
    }

    /// <summary>
    /// Redact query values whose keys look sensitive; always run through LogSafe for CR/LF.
    /// </summary>
    public static string SanitizeQueryString(string? query)
    {
        if (string.IsNullOrEmpty(query))
            return string.Empty;

        // Drop leading '?'
        var raw = query.StartsWith('?') ? query[1..] : query;
        if (string.IsNullOrEmpty(raw))
            return string.Empty;

        var parts = raw.Split('&', StringSplitOptions.RemoveEmptyEntries);
        var rebuilt = new List<string>(parts.Length);
        foreach (var part in parts)
        {
            var eq = part.IndexOf('=');
            if (eq <= 0)
            {
                rebuilt.Add(LogSafe.Text(part));
                continue;
            }

            var key = part[..eq];
            var isSensitive = SensitiveQueryFields.Any(f => key.Contains(f, StringComparison.OrdinalIgnoreCase));
            rebuilt.Add(isSensitive
                ? $"{LogSafe.Text(key)}=[REDACTED]"
                : $"{LogSafe.Text(key)}={LogSafe.Text(part[(eq + 1)..])}");
        }

        return "?" + string.Join('&', rebuilt);
    }
}
