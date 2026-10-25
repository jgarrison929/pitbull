using Pitbull.Core.Domain;

namespace Pitbull.TimeTracking.Domain;

/// <summary>
/// Tenant-specific configuration for pay period generation and auto-locking.
/// Each tenant has exactly one configuration record.
/// </summary>
public class PayPeriodConfiguration : BaseEntity
{
    /// <summary>
    /// Type of pay period (Weekly, BiWeekly, SemiMonthly, Monthly)
    /// </summary>
    public PayPeriodType Type { get; set; } = PayPeriodType.Weekly;

    /// <summary>
    /// Day of week that starts the pay period (for Weekly/BiWeekly types)
    /// </summary>
    public DayOfWeek WeekStartDay { get; set; } = DayOfWeek.Sunday;

    /// <summary>
    /// First day of month for semi-monthly periods (e.g., 1 for 1st)
    /// </summary>
    public int SemiMonthlyFirstDay { get; set; } = 1;

    /// <summary>
    /// Second day of month for semi-monthly periods (e.g., 16 for 16th)
    /// </summary>
    public int SemiMonthlySecondDay { get; set; } = 16;

    /// <summary>
    /// Whether to automatically lock periods after the grace period
    /// </summary>
    public bool AutoLockEnabled { get; set; } = false;

    /// <summary>
    /// Number of days after the period ends before auto-locking (grace period)
    /// </summary>
    public int AutoLockDaysAfterEnd { get; set; } = 3;

    /// <summary>
    /// How many periods ahead to auto-generate
    /// </summary>
    public int PeriodsToGenerateAhead { get; set; } = 4;

    /// <summary>
    /// Reference date for bi-weekly calculation (the start of a known bi-weekly period)
    /// </summary>
    public DateOnly? BiWeeklyReferenceDate { get; set; }

    /// <summary>
    /// Whether pay period enforcement is enabled
    /// When false, time entries are not restricted by pay period status
    /// </summary>
    public bool EnforcementEnabled { get; set; } = true;
}

/// <summary>
/// Types of pay period schedules
/// </summary>
public enum PayPeriodType
{
    /// <summary>
    /// Weekly - 7 days, starts on WeekStartDay
    /// </summary>
    Weekly = 0,

    /// <summary>
    /// Bi-weekly - 14 days, starts on WeekStartDay
    /// </summary>
    BiWeekly = 1,

    /// <summary>
    /// Semi-monthly - Two periods per month (e.g., 1-15 and 16-end)
    /// </summary>
    SemiMonthly = 2,

    /// <summary>
    /// Monthly - Full calendar month
    /// </summary>
    Monthly = 3
}
