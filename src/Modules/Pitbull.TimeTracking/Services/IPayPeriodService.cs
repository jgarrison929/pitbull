using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Services;

/// <summary>
/// Service for pay period calculations and management
/// </summary>
public interface IPayPeriodService
{
    /// <summary>
    /// Calculate the pay period boundaries for a given date based on configuration
    /// </summary>
    (DateOnly StartDate, DateOnly EndDate) CalculatePeriodBoundaries(DateOnly date, PayPeriodConfiguration config);

    /// <summary>
    /// Generate pay periods up to a specified number of periods ahead
    /// </summary>
    List<(DateOnly StartDate, DateOnly EndDate)> GenerateFuturePeriods(
        PayPeriodConfiguration config, 
        DateOnly fromDate, 
        int periodsAhead);

    /// <summary>
    /// Check if a date is within a locked pay period
    /// </summary>
    Task<bool> IsDateInLockedPeriodAsync(DateOnly date, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get the pay period containing a specific date
    /// </summary>
    Task<PayPeriod?> GetPayPeriodForDateAsync(DateOnly date, CancellationToken cancellationToken = default);

    /// <summary>
    /// Validate that a time entry can be created/modified for the given date
    /// Returns an error message if blocked, null if allowed
    /// </summary>
    Task<string?> ValidateTimeEntryDateAsync(DateOnly date, CancellationToken cancellationToken = default);
}
