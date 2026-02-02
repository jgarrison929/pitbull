using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Core.Features.GetDashboardStats;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Controller for dashboard-related operations
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
[EnableRateLimiting("api")]
public class DashboardController(IMediator mediator) : ControllerBase
{
    /// <summary>
    /// Get dashboard statistics for the current tenant
    /// </summary>
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var query = new GetDashboardStatsQuery();
        var result = await mediator.Send(query);
        
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }
}