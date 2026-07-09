namespace Pitbull.Api.Middleware;

/// <summary>
/// Restricts demo users (<c>IsDemoUser</c> / seeded demo personas) from mutating
/// admin and sensitive areas. Admin surfaces are <b>read-only</b> (GET/HEAD/OPTIONS).
/// Secrets remain fully blocked. Global DELETE is blocked for all demo traffic.
/// </summary>
public sealed class DemoRestrictionMiddleware(RequestDelegate next)
{
    /// <summary>
    /// Admin / system areas: demo users may read (GET) but not write.
    /// </summary>
    private static readonly string[] ReadOnlyPrefixes =
    [
        "/api/admin",
        "/api/users",
        "/api/system",
        "/api/roles",
        "/api/workflow-definitions",
        "/api/seed",
        "/api/tenants",
    ];

    /// <summary>
    /// Fully blocked even for GET (sensitive material not appropriate for public demos).
    /// </summary>
    private static readonly string[] FullyBlockedPrefixes =
    [
        "/api/secrets",
        "/api/secret-vault",
    ];

    /// <summary>
    /// Nested path segments under other resources that are admin-ish (user mgmt, etc.).
    /// Mutating methods only — GET remains allowed for browsing.
    /// </summary>
    private static readonly string[] ReadOnlySegments =
    [
        "/users",
        "/access",
        "/roles",
        "/permissions",
    ];

    private static readonly string[] AllowedPaths =
    [
        "/api/auth/demo-register",
        "/api/auth/demo-role-login",
        "/api/auth/demo-roles",
        "/api/auth/demo-users/export",
        "/api/companies/accessible",
    ];

    private static readonly HashSet<string> SafeMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        "GET", "HEAD", "OPTIONS"
    };

    private const string CompanySwitchPrefix = "/api/companies/switch/";

    public async Task InvokeAsync(HttpContext context)
    {
        if (!IsDemoPrincipal(context.User))
        {
            await next(context);
            return;
        }

        var path = context.Request.Path.Value?.ToLowerInvariant() ?? "";
        var method = context.Request.Method;

        foreach (var allowed in AllowedPaths)
        {
            if (path.Equals(allowed, StringComparison.OrdinalIgnoreCase))
            {
                await next(context);
                return;
            }
        }

        // Company switch by GUID only
        if (path.StartsWith(CompanySwitchPrefix, StringComparison.OrdinalIgnoreCase))
        {
            var suffix = path[CompanySwitchPrefix.Length..];
            if (Guid.TryParse(suffix, out _) && SafeMethods.Contains(method))
            {
                await next(context);
                return;
            }

            // POST switch is a state change — allow switching company for browsing
            if (Guid.TryParse(suffix, out _) && method.Equals("POST", StringComparison.OrdinalIgnoreCase))
            {
                await next(context);
                return;
            }

            await WriteForbidden(context, "Demo users cannot use that company switch path.");
            return;
        }

        // Secrets & vault: no access
        foreach (var prefix in FullyBlockedPrefixes)
        {
            if (path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                await WriteForbidden(context, "Demo users cannot access secrets or vault material.");
                return;
            }
        }

        // Never allow DELETE in the demo tenant
        if (method.Equals("DELETE", StringComparison.OrdinalIgnoreCase))
        {
            await WriteForbidden(context, "Demo users cannot delete data.");
            return;
        }

        // Admin / system: read-only
        foreach (var prefix in ReadOnlyPrefixes)
        {
            if (path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                if (SafeMethods.Contains(method))
                {
                    await next(context);
                    return;
                }

                await WriteForbidden(context,
                    "Demo admin access is read-only. Sign up for a full account to make changes.");
                return;
            }
        }

        // Nested user/role segments: block mutations only
        foreach (var segment in ReadOnlySegments)
        {
            var idx = path.IndexOf(segment, StringComparison.OrdinalIgnoreCase);
            if (idx > 5 && !SafeMethods.Contains(method))
            {
                await WriteForbidden(context,
                    "Demo admin access is read-only. Sign up for a full account to make changes.");
                return;
            }
        }

        await next(context);
    }

    /// <summary>
    /// True when JWT marks the user as a demo user, or the email is a known seeded persona.
    /// Email fallback covers tokens issued before IsDemoUser was backfilled.
    /// </summary>
    internal static bool IsDemoPrincipal(System.Security.Claims.ClaimsPrincipal user)
    {
        if (user.FindFirst("is_demo_user")?.Value == "true")
            return true;

        var email = user.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
            ?? user.FindFirst("email")?.Value
            ?? user.Identity?.Name;

        if (string.IsNullOrWhiteSpace(email))
            return false;

        if (email.EndsWith("@demo.local", StringComparison.OrdinalIgnoreCase))
            return true;

        if (email.Equals("demo@example.com", StringComparison.OrdinalIgnoreCase))
            return true;

        return false;
    }

    private static async Task WriteForbidden(HttpContext context, string message)
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await context.Response.WriteAsJsonAsync(new
        {
            error = message,
            code = "DEMO_READ_ONLY"
        });
    }
}
