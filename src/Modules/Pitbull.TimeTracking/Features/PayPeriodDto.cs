using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Entities;

namespace Pitbull.TimeTracking.Features;

/// <summary>
/// DTO for pay period data
/// </summary>
public record PayPeriodDto
{
    public Guid Id { get; init; }
    public Guid TenantId { get; init; }
    public DateOnly StartDate { get; init; }
    public DateOnly EndDate { get; init; }
    public PayPeriodStatus Status { get; init; }
    public string Name { get; init; } = string.Empty;
    public string StatusName => Status.ToString();
    public bool IsLocked => Status is PayPeriodStatus.Locked or PayPeriodStatus.Closed;
    public DateTime? LockedAt { get; init; }
    public Guid? LockedById { get; init; }
    public DateTime? PayrollExportMarkedAt { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? UpdatedAt { get; init; }

    /// <summary>
    /// Display label for the pay period (e.g., "Feb 9 - Feb 15, 2026")
    /// </summary>
    public string Label => Name;

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
    public Guid PayPeriodId { get; init; }
    public string PayPeriodName { get; init; } = string.Empty;
    public DateOnly StartDate { get; init; }
    public DateOnly EndDate { get; init; }
    public decimal TotalHours { get; init; }
    public int EmployeeCount { get; init; }
    public int EntryCount { get; init; }
    public List<PayPeriodStatusBreakdownDto> ByStatus { get; init; } = [];
}

public record PayPeriodStatusBreakdownDto(
    TimeEntryStatus Status,
    int EntryCount,
    decimal TotalHours);

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
            TenantId = period.TenantId,
            StartDate = period.StartDate,
            EndDate = period.EndDate,
            Status = period.Status,
            Name = period.Name,
            LockedAt = period.LockedAt,
            LockedById = period.LockedById,
            PayrollExportMarkedAt = period.PayrollExportMarkedAt,
            CreatedAt = period.CreatedAt,
            UpdatedAt = period.UpdatedAt
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
