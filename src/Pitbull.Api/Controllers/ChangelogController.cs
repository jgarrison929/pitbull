using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Services;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Serves structured release notes from CHANGELOG.md (Keep a Changelog).
/// </summary>
[ApiController]
[Route("api/changelog")]
[AllowAnonymous]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("System")]
public class ChangelogController(IChangelogService changelogService) : ControllerBase
{
    /// <summary>
    /// Get changelog entries. Filter with <c>version</c>, <c>current=true</c> (app assembly version),
    /// or <c>limit</c> for the newest N releases (includes Unreleased when present).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ChangelogResponse), 200)]
    public IActionResult Get(
        [FromQuery] string? version = null,
        [FromQuery] bool current = false,
        [FromQuery] int? limit = null)
    {
        // Cap filter inputs on this anonymous endpoint (DoS / noise).
        if (version is { Length: > 64 })
            version = version[..64];
        if (limit is < 1)
            limit = null;
        else if (limit is > 50)
            limit = 50;

        var result = changelogService.GetChangelog(version, current, limit);
        return Ok(result);
    }
}
