namespace Pitbull.Api.Middleware;

/// <summary>
/// Middleware to add security headers to all responses.
/// Implements OWASP security header recommendations for API endpoints.
/// </summary>
public class SecurityHeadersMiddleware(RequestDelegate next)
{
    private readonly RequestDelegate _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        // X-Content-Type-Options: Prevents MIME sniffing attacks
        context.Response.Headers.Append("X-Content-Type-Options", "nosniff");

        // X-Frame-Options: Prevents clickjacking (API shouldn't be framed anyway)
        context.Response.Headers.Append("X-Frame-Options", "DENY");

        // X-XSS-Protection: Legacy header but still useful for older browsers
        context.Response.Headers.Append("X-XSS-Protection", "1; mode=block");

        // Referrer-Policy: Minimize referrer information leakage
        context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");

        // Content-Security-Policy: For API, we want to prevent any content execution
        context.Response.Headers.Append("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none';");

        // Permissions-Policy: disable powerful browser features (API does not use them).
        context.Response.Headers.Append("Permissions-Policy",
            "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()");

        // Cross-Origin-Resource-Policy: keep API responses same-origin by default (CORS still gates browsers).
        context.Response.Headers.Append("Cross-Origin-Resource-Policy", "same-origin");

        // Cross-Origin-Opener-Policy: isolate any accidental document navigations from cross-origin openers.
        context.Response.Headers.Append("Cross-Origin-Opener-Policy", "same-origin");

        // Adobe/Flash legacy cross-domain policy file requests.
        context.Response.Headers.Append("X-Permitted-Cross-Domain-Policies", "none");

        // Never cache API responses (JWTs, PII, financial DTOs must not land in shared caches).
        context.Response.Headers.Append("Cache-Control", "no-store, no-cache, must-revalidate");
        context.Response.Headers.Append("Pragma", "no-cache");

        // Strict-Transport-Security (HSTS): Force HTTPS for 1 year
        // Note: Only send on HTTPS or when X-Forwarded-Proto indicates HTTPS (reverse proxy)
        var forwardedProto = context.Request.Headers["X-Forwarded-Proto"].FirstOrDefault();
        if (context.Request.IsHttps || string.Equals(forwardedProto, "https", StringComparison.OrdinalIgnoreCase))
        {
            // max-age=31536000 (1 year), includeSubDomains for comprehensive coverage
            context.Response.Headers.Append("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
        }

        // Remove server headers that reveal implementation details
        context.Response.Headers.Remove("Server");
        context.Response.Headers.Remove("X-Powered-By");
        context.Response.Headers.Remove("X-AspNet-Version");
        context.Response.Headers.Remove("X-AspNetMvc-Version");

        await _next(context);
    }
}
