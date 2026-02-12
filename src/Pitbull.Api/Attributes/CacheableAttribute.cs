using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Pitbull.Api.Attributes;

/// <summary>
/// Adds HTTP caching headers to controller actions for improved performance.
/// Use on GET endpoints that return relatively static data.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public class CacheableAttribute : ActionFilterAttribute
{
    /// <summary>
    /// Cache duration in seconds. Default: 5 minutes (300 seconds).
    /// </summary>
    public int DurationSeconds { get; set; } = 300;

    /// <summary>
    /// Whether the response can be cached by intermediate proxies (CDNs, etc.).
    /// Default: false (private cache only - browser cache only).
    /// </summary>
    public bool IsPublic { get; set; } = false;

    /// <summary>
    /// Whether the cache must revalidate with the origin server when stale.
    /// Default: true (ensures data consistency).
    /// </summary>
    public bool MustRevalidate { get; set; } = true;

    public override void OnActionExecuted(ActionExecutedContext context)
    {
        if (context.Result is ObjectResult objectResult && objectResult.StatusCode == 200)
        {
            var headers = context.HttpContext.Response.Headers;

            // Build cache-control directive
            var cacheControl = new List<string>();

            if (IsPublic)
                cacheControl.Add("public");
            else
                cacheControl.Add("private");

            cacheControl.Add($"max-age={DurationSeconds}");

            if (MustRevalidate)
                cacheControl.Add("must-revalidate");

            headers.Append("Cache-Control", string.Join(", ", cacheControl));

            // Add ETag based on response content hash (for conditional requests)
            if (objectResult.Value != null)
            {
                var contentHash = GenerateETag(objectResult.Value);
                headers.Append("ETag", $"\"{contentHash}\"");
            }

            // Add Vary header for tenant-scoped endpoints (different tenants = different content)
            if (context.HttpContext.User.Identity?.IsAuthenticated == true)
            {
                headers.Append("Vary", "Authorization");
            }
        }

        base.OnActionExecuted(context);
    }

    private static string GenerateETag(object content)
    {
        var json = System.Text.Json.JsonSerializer.Serialize(content);
        var hash = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(json));
        return Convert.ToBase64String(hash)[..16]; // Truncate for brevity
    }
}