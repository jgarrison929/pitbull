using Pitbull.Core.CQRS;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;

namespace Pitbull.TimeTracking.Services;

/// <summary>
/// Service for pay period calculations, management, and CRUD operations.
/// Replaces MediatR-based handlers with direct, testable methods.
/// </summary>
public interface IPayPeriodService
{
    // ============ Calculation Methods ============

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

    // ============ Query Methods ============

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

    /// <summary>
    /// List pay periods with filtering and pagination
    /// </summary>
    Task<Result<PagedResult<PayPeriodDto>>> ListPayPeriodsAsync(
        PayPeriodStatus? status,
        DateOnly? startDateFrom,
        DateOnly? startDateTo,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Get the current (or specified date's) pay period
    /// </summary>
    Task<Result<PayPeriodDto>> GetCurrentPayPeriodAsync(
        DateOnly? date = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Get the tenant's pay period configuration
    /// </summary>
    Task<Result<PayPeriodConfigurationDto>> GetConfigurationAsync(
        CancellationToken cancellationToken = default);

    // ============ Command Methods ============

    /// <summary>
    /// Lock a pay period to prevent modifications
    /// </summary>
    Task<Result<PayPeriodDto>> LockPayPeriodAsync(
        Guid payPeriodId,
        Guid lockedById,
        string? notes = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Unlock a pay period (requires reason for audit compliance)
    /// </summary>
    Task<Result<PayPeriodDto>> UnlockPayPeriodAsync(
        Guid payPeriodId,
        Guid unlockedById,
        string reason,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Update (or create) the tenant's pay period configuration
    /// </summary>
    Task<Result<PayPeriodConfigurationDto>> UpdateConfigurationAsync(
        PayPeriodType type,
        DayOfWeek weekStartDay,
        int semiMonthlyFirstDay,
        int semiMonthlySecondDay,
        bool autoLockEnabled,
        int autoLockDaysAfterEnd,
        int periodsToGenerateAhead,
        DateOnly? biWeeklyReferenceDate,
        bool enforcementEnabled,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Generate pay periods based on configuration
    /// </summary>
    Task<Result<GeneratePayPeriodsResult>> GeneratePayPeriodsAsync(
        DateOnly? fromDate = null,
        int? periodsToGenerate = null,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Result of pay period generation
/// </summary>
public record GeneratePayPeriodsResult(
    int PeriodsCreated,
    int PeriodsSkipped,
    List<PayPeriodDto> CreatedPeriods
);
