using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Attributes;
using Pitbull.Api.Services;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Briefing")]
public class BriefingController(IBriefingService briefingService) : ControllerBase
{
    [HttpGet("morning")]
    [Cacheable(DurationSeconds = 300)]
    [ProducesResponseType(typeof(MorningBriefingDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetMorningBriefing(CancellationToken ct)
    {
        var userIdClaim = User.FindFirst("sub") ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
            return Unauthorized(new { error = "Invalid user identity" });

        var userName = User.FindFirst("full_name")?.Value
            ?? User.FindFirst(ClaimTypes.Name)?.Value
            ?? "User";

        var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();

        var briefing = await briefingService.GetMorningBriefingAsync(userId, userName, roles, ct);
        return Ok(briefing);
    }
}
