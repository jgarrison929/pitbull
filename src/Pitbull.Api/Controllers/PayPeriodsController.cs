using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Extensions;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;
using Pitbull.TimeTracking.Services;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Pay period management for time entry locking.
/// Controls when time entries can be modified based on payroll cycles.
/// </summary>
[ApiController]
[Route("api/pay-periods")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Pay Periods")]
public class PayPeriodsController(IPayPeriodService payPeriodService) : ControllerBase
{
    /// <summary>
    /// List all pay periods with optional filtering
    /// </summary>
    /// <remarks>
    /// Returns paginated pay periods ordered by start date (most recent first).
    /// Use filters to find specific periods by status or date range.
    /// </remarks>
    /// <param name="status">Filter by status (Open=0, Locked=1, Processed=2)</param>
    /// <param name="startDateFrom">Filter periods starting on or after this date</param>
    /// <param name="startDateTo">Filter periods starting on or before this date</param>
    /// <param name="page">Page number (default: 1)</param>
    /// <param name="pageSize">Items per page (default: 25, max: 100)</param>
    /// <returns>Paginated list of pay periods</returns>
    /// <response code="200">Pay periods list</response>
    /// <response code="401">Not authenticated</response>
    [HttpGet]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> List(
        [FromQuery] PayPeriodStatus? status,
        [FromQuery] DateOnly? startDateFrom,
        [FromQuery] DateOnly? startDateTo,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        var result = await payPeriodService.ListPayPeriodsAsync(
            status, startDateFrom, startDateTo, page, pageSize);

        if (!result.IsSuccess)
            return this.BadRequestError(result.Error ?? "Request failed");

        return Ok(result.Value);
    }

    /// <summary>
    /// Get the current (or specified date's) pay period
    /// </summary>
    /// <remarks>
    /// Returns the pay period containing today's date (or the specified date).
    /// If no period exists yet, returns calculated boundaries based on configuration.
    /// A period with Id = Guid.Empty indicates it hasn't been created yet.
    /// </remarks>
    /// <param name="date">Date to find period for (defaults to today)</param>
    /// <returns>Pay period for the specified date</returns>
    /// <response code="200">Current pay period</response>
    /// <response code="401">Not authenticated</response>
    [HttpGet("current")]
    [ProducesResponseType(typeof(PayPeriodDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetCurrent([FromQuery] DateOnly? date)
    {
        var result = await payPeriodService.GetCurrentPayPeriodAsync(date);
        
        if (!result.IsSuccess)
            return this.BadRequestError(result.Error ?? "Request failed");

        return Ok(result.Value);
    }

    /// <summary>
    /// Lock a pay period (Admin only)
    /// </summary>
    /// <remarks>
    /// Locks a pay period, preventing any time entry modifications for dates within that period.
    /// Only administrators can lock periods.
    /// Once locked, use the unlock endpoint (with required reason) to re-open if needed.
    /// </remarks>
    /// <param name="id">Pay period unique identifier</param>
    /// <param name="request">Lock details including who is locking</param>
    /// <returns>Updated pay period with Locked status</returns>
    /// <response code="200">Pay period locked successfully</response>
    /// <response code="400">Period already locked or invalid request</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="403">Not authorized (Admin only)</response>
    /// <response code="404">Pay period not found</response>
    [HttpPost("{id:guid}/lock")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(typeof(PayPeriodDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Lock(Guid id, [FromBody] LockPayPeriodRequest request)
    {
        var result = await payPeriodService.LockPayPeriodAsync(
            id, request.LockedById, request.Notes);

        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => this.NotFoundError(result.Error ?? "Pay period not found"),
                _ => this.BadRequestError(result.Error ?? "Request failed")
            };
        }

        return Ok(result.Value);
    }

    /// <summary>
    /// Unlock a pay period (Admin only, requires reason)
    /// </summary>
    /// <remarks>
    /// Unlocks a previously locked pay period, allowing time entry modifications.
    /// Requires a reason for audit compliance.
    /// This action is logged and should only be used for corrections.
    /// </remarks>
    /// <param name="id">Pay period unique identifier</param>
    /// <param name="request">Unlock details including reason</param>
    /// <returns>Updated pay period with Open status</returns>
    /// <response code="200">Pay period unlocked successfully</response>
    /// <response code="400">Period already open or missing reason</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="403">Not authorized (Admin only)</response>
    /// <response code="404">Pay period not found</response>
    [HttpPost("{id:guid}/unlock")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(PayPeriodDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Unlock(Guid id, [FromBody] UnlockPayPeriodRequest request)
    {
        var result = await payPeriodService.UnlockPayPeriodAsync(
            id, request.UnlockedById, request.Reason);

        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => this.NotFoundError(result.Error ?? "Pay period not found"),
                "REASON_REQUIRED" => this.BadRequestError(result.Error ?? "Reason is required"),
                _ => this.BadRequestError(result.Error ?? "Request failed")
            };
        }

        return Ok(result.Value);
    }

    /// <summary>
    /// Get the tenant's pay period configuration
    /// </summary>
    /// <remarks>
    /// Returns the configuration controlling pay period generation:
    /// - Period type (Weekly, BiWeekly, SemiMonthly, Monthly)
    /// - Week start day
    /// - Semi-monthly day splits
    /// - Auto-lock settings
    /// 
    /// If no configuration exists, returns default values.
    /// </remarks>
    /// <returns>Pay period configuration</returns>
    /// <response code="200">Configuration retrieved</response>
    /// <response code="401">Not authenticated</response>
    [HttpGet("configuration")]
    [ProducesResponseType(typeof(PayPeriodConfigurationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetConfiguration()
    {
        var result = await payPeriodService.GetConfigurationAsync();

        if (!result.IsSuccess)
            return this.BadRequestError(result.Error ?? "Request failed");

        return Ok(result.Value);
    }

    /// <summary>
    /// Update the tenant's pay period configuration (Admin only)
    /// </summary>
    /// <remarks>
    /// Updates (or creates) the pay period configuration.
    /// Changes affect future period generation but don't modify existing periods.
    /// 
    /// Period Types:
    /// - Weekly (0): 7-day periods starting on WeekStartDay
    /// - BiWeekly (1): 14-day periods starting on WeekStartDay
    /// - SemiMonthly (2): Two periods per month (e.g., 1-15 and 16-end)
    /// - Monthly (3): Full calendar month
    /// </remarks>
    /// <param name="request">New configuration values</param>
    /// <returns>Updated configuration</returns>
    /// <response code="200">Configuration updated</response>
    /// <response code="400">Invalid configuration values</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="403">Not authorized (Admin only)</response>
    [HttpPut("configuration")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(PayPeriodConfigurationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UpdateConfiguration([FromBody] UpdatePayPeriodConfigurationRequest request)
    {
        var result = await payPeriodService.UpdateConfigurationAsync(
            request.Type,
            request.WeekStartDay,
            request.SemiMonthlyFirstDay,
            request.SemiMonthlySecondDay,
            request.AutoLockEnabled,
            request.AutoLockDaysAfterEnd,
            request.PeriodsToGenerateAhead,
            request.BiWeeklyReferenceDate,
            request.EnforcementEnabled
        );

        if (!result.IsSuccess)
            return this.BadRequestError(result.Error ?? "Request failed");

        return Ok(result.Value);
    }

    /// <summary>
    /// Generate pay periods based on configuration (Admin only)
    /// </summary>
    /// <remarks>
    /// Generates pay periods for the current and upcoming cycles based on configuration.
    /// Skips any periods that already exist (based on start date).
    /// 
    /// Use this to:
    /// - Initialize periods for a new tenant
    /// - Generate future periods in advance
    /// - Backfill missing periods
    /// </remarks>
    /// <param name="request">Generation parameters</param>
    /// <returns>Summary of periods created/skipped</returns>
    /// <response code="200">Periods generated</response>
    /// <response code="400">Configuration not found or invalid parameters</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="403">Not authorized (Admin only)</response>
    [HttpPost("generate")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(typeof(GeneratePayPeriodsResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Generate([FromBody] GeneratePayPeriodsRequest request)
    {
        var result = await payPeriodService.GeneratePayPeriodsAsync(
            request.FromDate, request.PeriodsToGenerate);

        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "CONFIG_NOT_FOUND" => this.BadRequestError(result.Error ?? "Configuration not found"),
                _ => this.BadRequestError(result.Error ?? "Request failed")
            };
        }

        return Ok(result.Value);
    }
}

// Request DTOs
public record LockPayPeriodRequest(
    Guid LockedById,
    string? Notes = null
);

public record UnlockPayPeriodRequest(
    Guid UnlockedById,
    string Reason
);

public record UpdatePayPeriodConfigurationRequest(
    PayPeriodType Type,
    DayOfWeek WeekStartDay,
    int SemiMonthlyFirstDay = 1,
    int SemiMonthlySecondDay = 16,
    bool AutoLockEnabled = false,
    int AutoLockDaysAfterEnd = 3,
    int PeriodsToGenerateAhead = 4,
    DateOnly? BiWeeklyReferenceDate = null,
    bool EnforcementEnabled = true
);

public record GeneratePayPeriodsRequest(
    DateOnly? FromDate = null,
    int? PeriodsToGenerate = null
);
