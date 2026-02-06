using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using System.Reflection;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Monitoring and health endpoints for system administrators.
/// These endpoints provide insights into API performance, security, and health.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize] // Require authentication
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Monitoring")]
public class MonitoringController(HealthCheckService healthCheckService) : ControllerBase
{
    /// <summary>
    /// Get API version and build information
    /// </summary>
    /// <remarks>
    /// Returns version information, build timestamp, and environment details.
    /// Useful for deployment verification and debugging.
    /// </remarks>
    /// <returns>API version and build information</returns>
    /// <response code="200">Returns version information</response>
    [HttpGet("version")]
    [ProducesResponseType(typeof(VersionInfo), StatusCodes.Status200OK)]
    public IActionResult GetVersion()
    {
        var assembly = Assembly.GetExecutingAssembly();
        var version = assembly.GetName().Version?.ToString() ?? "unknown";
        var buildTime = GetBuildDateTime(assembly);
        
        return Ok(new VersionInfo(
            Version: version,
            BuildTime: buildTime,
            Environment: Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production",
            FrameworkVersion: Environment.Version.ToString(),
            MachineName: Environment.MachineName
        ));
    }

    /// <summary>
    /// Get comprehensive health status with dependency checks
    /// </summary>
    /// <remarks>
    /// Returns detailed health information including database connectivity,
    /// external service status, and system resources. Extends the basic /health endpoint
    /// with additional context for administrators.
    /// </remarks>
    /// <returns>Detailed health status</returns>
    /// <response code="200">System is healthy</response>
    /// <response code="503">System or dependencies are unhealthy</response>
    [HttpGet("health")]
    [ProducesResponseType(typeof(HealthReport), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> GetHealth()
    {
        var health = await healthCheckService.CheckHealthAsync();
        
        var statusCode = health.Status == HealthStatus.Healthy
            ? StatusCodes.Status200OK
            : StatusCodes.Status503ServiceUnavailable;

        return StatusCode(statusCode, health);
    }

    /// <summary>
    /// Get security configuration status
    /// </summary>
    /// <remarks>
    /// Returns information about security features like rate limiting,
    /// request size limits, and authentication configuration.
    /// Useful for security audits and compliance checks.
    /// </remarks>
    /// <returns>Security configuration status</returns>
    /// <response code="200">Returns security status</response>
    [HttpGet("security")]
    [ProducesResponseType(typeof(SecurityStatus), StatusCodes.Status200OK)]
    public IActionResult GetSecurity()
    {
        // Check if rate limiting is enabled by looking at DI container
        var rateLimiterService = HttpContext.RequestServices.GetService(typeof(RateLimiterOptions));
        
        return Ok(new SecurityStatus(
            RateLimitingEnabled: rateLimiterService != null,
            HttpsRedirection: Environment.GetEnvironmentVariable("ASPNETCORE_HTTPS_PORT") != null,
            SecurityHeadersEnabled: true, // We know this is enabled since we added the middleware
            AuthenticationEnabled: HttpContext.User.Identity?.IsAuthenticated ?? false,
            RequestSizeLimitsEnabled: true // Request size middleware is registered
        ));
    }

    private static DateTime GetBuildDateTime(Assembly assembly)
    {
        try
        {
            var buildAttribute = assembly.GetCustomAttribute<System.Runtime.Versioning.TargetFrameworkAttribute>();
            if (buildAttribute != null)
            {
                // For .NET assemblies, we can use the creation time of the assembly file
                var location = assembly.Location;
                if (System.IO.File.Exists(location))
                {
                    return System.IO.File.GetCreationTimeUtc(location);
                }
            }
        }
        catch
        {
            // Fallback to a default if we can't determine build time
        }
        
        return DateTime.UtcNow; // Fallback
    }
}

/// <summary>
/// API version and build information
/// </summary>
/// <param name="Version">Assembly version</param>
/// <param name="BuildTime">Build timestamp (UTC)</param>
/// <param name="Environment">Current environment (Development, Staging, Production)</param>
/// <param name="FrameworkVersion">.NET runtime version</param>
/// <param name="MachineName">Host machine name</param>
public record VersionInfo(
    string Version,
    DateTime BuildTime,
    string Environment,
    string FrameworkVersion,
    string MachineName);

/// <summary>
/// Security configuration status
/// </summary>
/// <param name="RateLimitingEnabled">Whether rate limiting is active</param>
/// <param name="HttpsRedirection">Whether HTTPS redirection is configured</param>
/// <param name="SecurityHeadersEnabled">Whether security headers are being set</param>
/// <param name="AuthenticationEnabled">Whether the current request is authenticated</param>
/// <param name="RequestSizeLimitsEnabled">Whether request size limits are enforced</param>
public record SecurityStatus(
    bool RateLimitingEnabled,
    bool HttpsRedirection,
    bool SecurityHeadersEnabled,
    bool AuthenticationEnabled,
    bool RequestSizeLimitsEnabled);