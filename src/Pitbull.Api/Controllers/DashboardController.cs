using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Attributes;
using Pitbull.Core.Features.GetDashboardStats;
using Pitbull.Core.Features.GetWeeklyHours;

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
    [Cacheable(DurationSeconds = 60)] // Cache for 1 minute (dashboard data changes frequently)
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

    /// <summary>
    /// Get weekly hours data for charts
    /// </summary>
    /// <remarks>
    /// Returns weekly aggregated hours data for the specified number of weeks.
    /// Includes regular, overtime, and double-time hours breakdown.
    /// Useful for rendering labor trend charts on the dashboard.
    ///
    /// Sample response:
    ///
    ///     {
    ///         "data": [
    ///             {
    ///                 "weekLabel": "Jan 6",
    ///                 "weekStart": "2026-01-06",
    ///                 "regularHours": 320.0,
    ///                 "overtimeHours": 45.5,
    ///                 "doubleTimeHours": 8.0,
    ///                 "totalHours": 373.5
    ///             }
    ///         ],
    ///         "totalHours": 2988.0,
    ///         "averageHoursPerWeek": 373.5
    ///     }
    ///
    /// </remarks>
    /// <param name="weeks">Number of weeks to retrieve (1-52, default: 8)</param>
    /// <returns>Weekly hours data</returns>
    /// <response code="200">Returns weekly hours data</response>
    /// <response code="401">Not authenticated</response>
    [HttpGet("weekly-hours")]
    [Cacheable(DurationSeconds = 300)] // Cache for 5 minutes
    [ProducesResponseType(typeof(WeeklyHoursResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetWeeklyHours([FromQuery] int weeks = 8)
    {
        var query = new GetWeeklyHoursQuery(weeks);
        var result = await mediator.Send(query);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }
}
