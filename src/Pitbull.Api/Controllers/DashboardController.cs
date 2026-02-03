using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Core.Features.GetDashboardStats;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Dashboard analytics and statistics. Provides aggregated metrics
/// for the current tenant's projects, bids, and activity.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Dashboard")]
public class DashboardController(IMediator mediator) : ControllerBase
{
    /// <summary>
    /// Get dashboard statistics for the current tenant
    /// </summary>
    /// <remarks>
    /// Returns aggregated statistics including project count, bid count,
    /// total values, pending change orders, and last activity date.
    /// All data is scoped to the authenticated user's tenant.
    ///
    /// Sample response:
    ///
    ///     {
    ///         "projectCount": 12,
    ///         "bidCount": 25,
    ///         "totalProjectValue": 15000000.00,
    ///         "totalBidValue": 8500000.00,
    ///         "pendingChangeOrders": 3,
    ///         "lastActivityDate": "2026-02-01T18:30:00Z"
    ///     }
    ///
    /// </remarks>
    /// <returns>Dashboard statistics</returns>
    /// <response code="200">Returns dashboard statistics</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpGet("stats")]
    [ProducesResponseType(typeof(DashboardStatsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetStats()
    {
        var query = new GetDashboardStatsQuery();
        var result = await mediator.Send(query);
        
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }
}
