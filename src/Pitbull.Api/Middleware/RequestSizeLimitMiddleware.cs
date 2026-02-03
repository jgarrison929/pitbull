using Microsoft.Extensions.Options;

namespace Pitbull.Api.Middleware;

/// <summary>
/// Middleware to enforce request size limits for security.
/// Prevents large payload attacks and ensures consistent limits across different hosting environments.
/// </summary>
public class RequestSizeLimitMiddleware(RequestDelegate next, IOptions<RequestSizeLimitOptions> options)
{
    private readonly RequestDelegate _next = next;
    private readonly RequestSizeLimitOptions _options = options.Value;

    public async Task InvokeAsync(HttpContext context)
    {
        // Apply per-endpoint size limits if configured
        var endpoint = context.GetEndpoint();
        if (endpoint != null)
        {
            var endpointPath = endpoint.DisplayName?.ToLowerInvariant() ?? "";
            
            // Special handling for file upload endpoints (when implemented)
            if (endpointPath.Contains("upload") || endpointPath.Contains("document"))
            {
                // Future: larger limit for document uploads
                var feature = context.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature>();
                if (feature != null && !feature.IsReadOnly)
                {
                    feature.MaxRequestBodySize = _options.DocumentUploadMaxSize;
                }
            }
            else if (context.Request.Method == "POST" || context.Request.Method == "PUT" || context.Request.Method == "PATCH")
            {
                // Standard API payload limit
                var feature = context.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature>();
                if (feature != null && !feature.IsReadOnly)
                {
                    feature.MaxRequestBodySize = _options.ApiMaxSize;
                }
            }
        }

        await _next(context);
    }
}

/// <summary>
/// Configuration options for request size limits.
/// </summary>
public class RequestSizeLimitOptions
{
    public const string SectionName = "RequestSizeLimits";
    
    /// <summary>
    /// Maximum size for standard API requests (JSON payloads). Default: 1 MB.
    /// </summary>
    public long ApiMaxSize { get; set; } = 1_048_576; // 1 MB
    
    /// <summary>
    /// Maximum size for document upload requests. Default: 50 MB.
    /// </summary>
    public long DocumentUploadMaxSize { get; set; } = 52_428_800; // 50 MB
    
    /// <summary>
    /// Global maximum request size (fallback). Default: 10 MB.
    /// </summary>
    public long GlobalMaxSize { get; set; } = 10_485_760; // 10 MB
}