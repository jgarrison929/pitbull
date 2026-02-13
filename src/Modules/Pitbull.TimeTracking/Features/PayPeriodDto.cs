using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features;

/// <summary>
/// DTO for pay period data
/// </summary>
public record PayPeriodDto
{
    public Guid Id { get; init; }
    public DateOnly StartDate { get; init; }
    public DateOnly EndDate { get; init; }
    public PayPeriodStatus Status { get; init; }
    public string StatusName => Status.ToString();
    public bool IsLocked => Status == PayPeriodStatus.Locked || Status == PayPeriodStatus.Processed;
    public DateTime? LockedAt { get; init; }
    public Guid? LockedById { get; init; }
    public string? LockedByName { get; init; }
    public string? Notes { get; init; }
    public DateTime? ProcessedAt { get; init; }
    public Guid? ProcessedById { get; init; }
    public string? ProcessedByName { get; init; }
    public DateTime CreatedAt { get; init; }

    /// <summary>
    /// Display label for the pay period (e.g., "Feb 9 - Feb 15, 2026")
    /// </summary>
    public string Label => $"{StartDate:MMM d} - {EndDate:MMM d, yyyy}";

    /// <summary>
    /// Number of days in this pay period
    /// </summary>
    public int DayCount => EndDate.DayNumber - StartDate.DayNumber + 1;
}

/// <summary>
/// DTO for pay period configuration
/// </summary>
public record PayPeriodConfigurationDto
{
    public Guid Id { get; init; }
    public PayPeriodType Type { get; init; }
    public string TypeName => Type.ToString();
    public DayOfWeek WeekStartDay { get; init; }
    public string WeekStartDayName => WeekStartDay.ToString();
    public int SemiMonthlyFirstDay { get; init; }
    public int SemiMonthlySecondDay { get; init; }
    public bool AutoLockEnabled { get; init; }
    public int AutoLockDaysAfterEnd { get; init; }
    public int PeriodsToGenerateAhead { get; init; }
    public DateOnly? BiWeeklyReferenceDate { get; init; }
    public bool EnforcementEnabled { get; init; }
}

/// <summary>
/// Summary statistics for pay periods
/// </summary>
public record PayPeriodSummaryDto
{
    public PayPeriodDto? CurrentPeriod { get; init; }
    public int TotalPeriods { get; init; }
    public int OpenPeriods { get; init; }
    public int LockedPeriods { get; init; }
    public int ProcessedPeriods { get; init; }
    public DateOnly? NextAutoLockDate { get; init; }
}

/// <summary>
/// Mapper for pay period entities to DTOs
/// </summary>
public static class PayPeriodMapper
{
    public static PayPeriodDto ToDto(PayPeriod period)
    {
        return new PayPeriodDto
        {
            Id = period.Id,
            StartDate = period.StartDate,
            EndDate = period.EndDate,
            Status = period.Status,
            LockedAt = period.LockedAt,
            LockedById = period.LockedById,
            LockedByName = period.LockedBy != null
                ? $"{period.LockedBy.FirstName} {period.LockedBy.LastName}"
                : null,
            Notes = period.Notes,
            ProcessedAt = period.ProcessedAt,
            ProcessedById = period.ProcessedById,
            ProcessedByName = period.ProcessedBy != null
                ? $"{period.ProcessedBy.FirstName} {period.ProcessedBy.LastName}"
                : null,
            CreatedAt = period.CreatedAt
        };
    }

    public static PayPeriodConfigurationDto ToDto(PayPeriodConfiguration config)
    {
        return new PayPeriodConfigurationDto
        {
            Id = config.Id,
            Type = config.Type,
            WeekStartDay = config.WeekStartDay,
            SemiMonthlyFirstDay = config.SemiMonthlyFirstDay,
            SemiMonthlySecondDay = config.SemiMonthlySecondDay,
            AutoLockEnabled = config.AutoLockEnabled,
            AutoLockDaysAfterEnd = config.AutoLockDaysAfterEnd,
            PeriodsToGenerateAhead = config.PeriodsToGenerateAhead,
            BiWeeklyReferenceDate = config.BiWeeklyReferenceDate,
            EnforcementEnabled = config.EnforcementEnabled
        };
    }
}
