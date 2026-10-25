using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/version")]
[AllowAnonymous]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("System")]
public class VersionController : ControllerBase
{
    private static readonly Lazy<VersionInfo> _versionInfo = new(() =>
    {
        var resolved = VersionEndpointResolver.ResolveFromAssembly(Assembly.GetExecutingAssembly());
        return new VersionInfo(resolved.Version, resolved.BuildDate, resolved.CommitHash);
    });

    /// <summary>
    /// Get application version, build date, and commit hash
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(VersionInfo), 200)]
    public IActionResult Get() => Ok(_versionInfo.Value);

    private record VersionInfo(string Version, string BuildDate, string CommitHash);
}
