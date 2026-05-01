using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace Pitbull.Api.Middleware;

/// <summary>
/// Gates access to API documentation endpoints (/openapi/*, /scalar/*) behind JWT Bearer authentication.
/// Controlled by configuration:
///   ApiDocs:Enabled (default true) — set false to disable API docs entirely.
///   ApiDocs:RequireAuth (default true) — set false to allow unauthenticated access (e.g. in development).
/// </summary>
public class SwaggerAuthMiddleware(RequestDelegate next, IConfiguration configuration)
{
    private static bool IsApiDocsPath(PathString path) =>
        path.StartsWithSegments("/openapi") ||
        path.StartsWithSegments("/scalar");

    public async Task InvokeAsync(HttpContext context)
    {
        if (!IsApiDocsPath(context.Request.Path))
        {
            await next(context);
            return;
        }

        // Check if API docs are enabled at all
        var enabled = configuration.GetValue("ApiDocs:Enabled", true);
        if (!enabled)
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        // Check if auth is required for Swagger
        var requireAuth = configuration.GetValue("ApiDocs:RequireAuth", true);
        if (!requireAuth)
        {
            await next(context);
            return;
        }

        // Validate JWT Bearer token
        var authHeader = context.Request.Headers.Authorization.ToString();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync("""{"error":"Authentication required to access API documentation."}""");
            return;
        }

        var token = authHeader["Bearer ".Length..].Trim();
        var jwtKey = configuration["Jwt:Key"];
        if (string.IsNullOrEmpty(jwtKey))
        {
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            return;
        }

        try
        {
            var handler = new JwtSecurityTokenHandler();
            handler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = configuration["Jwt:Issuer"],
                ValidAudience = configuration["Jwt:Audience"],
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
            }, out _);

            await next(context);
        }
        catch (SecurityTokenException)
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync("""{"error":"Invalid or expired token."}""");
        }
    }
}
