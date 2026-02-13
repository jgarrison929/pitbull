using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Attributes;
using Pitbull.Core.Features.Dashboard;

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
public class DashboardController(IDashboardService dashboardService) : ControllerBase
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
        var result = await dashboardService.GetStatsAsync();

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
        var result = await dashboardService.GetWeeklyHoursAsync(weeks);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    /// <summary>
    /// Get RFIs needing attention (overdue or assigned to current user)
    /// </summary>
    /// <remarks>
    /// Returns RFIs that require attention, prioritized by urgency:
    /// - Overdue RFIs (past due date)
    /// - RFIs where the current user is "ball in court"
    ///
    /// Sample response:
    ///
    ///     {
    ///         "overdueCount": 3,
    ///         "ballInCourtCount": 2,
    ///         "totalCount": 5,
    ///         "items": [
    ///             {
    ///                 "id": "...",
    ///                 "number": 42,
    ///                 "subject": "Foundation depth clarification",
    ///                 "projectId": "...",
    ///                 "projectName": "Office Building",
    ///                 "projectNumber": "P-2026-001",
    ///                 "priority": "High",
    ///                 "dueDate": "2026-02-10",
    ///                 "daysOverdue": 3,
    ///                 "isOverdue": true,
    ///                 "isBallInCourt": false,
    ///                 "ballInCourtName": "John Architect"
    ///             }
    ///         ]
    ///     }
    ///
    /// </remarks>
    /// <param name="limit">Maximum number of RFIs to return (1-20, default: 5)</param>
    /// <returns>RFIs needing attention</returns>
    /// <response code="200">Returns RFIs needing attention</response>
    /// <response code="401">Not authenticated</response>
    [HttpGet("rfis-needing-attention")]
    [Cacheable(DurationSeconds = 60)] // Cache for 1 minute
    [ProducesResponseType(typeof(RfisNeedingAttentionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetRfisNeedingAttention([FromQuery] int limit = 5)
    {
        // Get current user ID from claims if available
        Guid? userId = null;
        var userIdClaim = User.FindFirst("sub") ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var parsedUserId))
        {
            userId = parsedUserId;
        }

        var result = await dashboardService.GetRfisNeedingAttentionAsync(userId, limit);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }
}
