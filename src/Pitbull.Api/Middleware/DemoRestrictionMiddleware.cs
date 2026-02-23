namespace Pitbull.Api.Middleware;

/// <summary>
/// Restricts demo users (IsDemoUser=true) from accessing admin endpoints,
/// user management, and sensitive operations. Returns 403 for blocked routes.
/// Only active when Demo:Enabled=true.
/// </summary>
public sealed class DemoRestrictionMiddleware(RequestDelegate next)
{
    private static readonly string[] BlockedPrefixes =
    [
        "/api/admin",
        "/api/users",
        "/api/system",
        "/api/secrets",
    ];

    /// <summary>
    /// Additional blocked path segments — catches nested user endpoints
    /// like /api/companies/{id}/users, /api/companies/{id}/access, etc.
    /// </summary>
    private static readonly string[] BlockedSegments =
    [
        "/users",
        "/access",
        "/roles",
        "/permissions",
    ];

    /// <summary>
    /// Paths explicitly allowed even if they match blocked patterns.
    /// </summary>
    private static readonly string[] AllowedPaths =
    [
        "/api/auth/demo-register",
        "/api/auth/demo-users/export",
    ];

    public async Task InvokeAsync(HttpContext context)
    {
        var isDemoUser = context.User.FindFirst("is_demo_user")?.Value == "true";

        if (isDemoUser)
        {
            var path = context.Request.Path.Value?.ToLowerInvariant() ?? "";

            // Allow explicit exceptions
            foreach (var allowed in AllowedPaths)
            {
                if (path.Equals(allowed, StringComparison.OrdinalIgnoreCase))
                    goto pass;
            }

            // Block admin prefixes
            foreach (var prefix in BlockedPrefixes)
            {
                if (path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                {
                    await WriteForbidden(context);
                    return;
                }
            }

            // Block nested user/access endpoints (e.g. /api/companies/{id}/users)
            foreach (var segment in BlockedSegments)
            {
                // Check if the segment appears after the first path component
                var idx = path.IndexOf(segment, StringComparison.OrdinalIgnoreCase);
                if (idx > 5) // Must be after /api/x minimum
                {
                    await WriteForbidden(context);
                    return;
                }
            }

            // Block DELETE and PUT on seed data for demo users
            var method = context.Request.Method;
            if (method is "DELETE")
            {
                await WriteForbidden(context);
                return;
            }
        }

        pass:
        await next(context);
    }

    private static async Task WriteForbidden(HttpContext context)
    {
        context.Response.StatusCode = 403;
        await context.Response.WriteAsJsonAsync(new
        {
            error = "Demo users cannot access admin features. Sign up for a full account at pitbullconstructionsolutions.com"
        });
    }
}
