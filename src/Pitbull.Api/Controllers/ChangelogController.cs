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
    /// <c>limit</c>/<c>offset</c> for progressive pages, or <c>excludeUnreleased=true</c> for history browse.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ChangelogResponse), 200)]
    public IActionResult Get(
        [FromQuery] string? version = null,
        [FromQuery] bool current = false,
        [FromQuery] int? limit = null,
        [FromQuery] int offset = 0,
        [FromQuery] bool excludeUnreleased = false)
    {
        // Cap filter inputs on this anonymous endpoint (DoS / noise).
        if (version is { Length: > 64 })
            version = version[..64];
        if (limit is < 1)
            limit = null;
        else if (limit is > ChangelogService.MaxPageSize)
            limit = ChangelogService.MaxPageSize;
        if (offset < 0)
            offset = 0;
        // Guard pathological skips on the anonymous endpoint.
        if (offset > 10_000)
            offset = 10_000;

        var result = changelogService.GetChangelog(version, current, limit, offset, excludeUnreleased);
        return Ok(result);
    }
}
