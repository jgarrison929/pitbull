using Pitbull.Core.Logging;
using Serilog.Context;

namespace Pitbull.Api.Middleware;

public class CorrelationIdMiddleware(RequestDelegate next)
{
    public const string CorrelationIdHeaderName = "X-Correlation-Id";
    public const string CorrelationIdItemName = "CorrelationId";

    /// <summary>Max length for accepted client-supplied correlation IDs (GUID string = 36).</summary>
    public const int MaxCorrelationIdLength = 64;

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = ResolveCorrelationId(
            context.Request.Headers[CorrelationIdHeaderName].FirstOrDefault());

        context.Items[CorrelationIdItemName] = correlationId;
        context.Response.Headers[CorrelationIdHeaderName] = correlationId;

        using (LogContext.PushProperty(CorrelationIdItemName, correlationId))
        {
            await next(context);
        }
    }

    /// <summary>
    /// Accept only allowlisted client IDs (length-capped). Invalid / forged headers
    /// (CR/LF, control chars, specials) get a server-generated GUID — never echo them
    /// into Items, response headers, or Serilog LogContext.
    /// </summary>
    internal static string ResolveCorrelationId(string? headerValue)
    {
        if (string.IsNullOrWhiteSpace(headerValue))
            return Guid.NewGuid().ToString();

        var candidate = headerValue.Trim();
        if (candidate.Length == 0 || candidate.Length > MaxCorrelationIdLength)
            return Guid.NewGuid().ToString();

        // Allowlist on raw value first so CR/LF / controls cannot slip through via
        // strip-then-accept (forged "a\r\nb" must not become "ab").
        for (var i = 0; i < candidate.Length; i++)
        {
            var c = candidate[i];
            if (!char.IsAsciiLetterOrDigit(c) && c != '-' && c != '_')
                return Guid.NewGuid().ToString();
        }

        // Explicit LogSafe barrier for static analyzers (cs/log-forging) even though
        // allowlist already excluded control characters.
        return LogSafe.Text(candidate);
    }
}
