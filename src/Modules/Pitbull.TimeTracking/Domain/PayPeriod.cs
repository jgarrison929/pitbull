using Pitbull.Core.Domain;

namespace Pitbull.TimeTracking.Domain;

/// <summary>
/// Represents a pay period for time entry locking.
/// Once a pay period is locked, time entries within that period cannot be modified.
/// </summary>
public class PayPeriod : BaseEntity
{
    /// <summary>
    /// Start date of the pay period (inclusive)
    /// </summary>
    public DateOnly StartDate { get; set; }

    /// <summary>
    /// End date of the pay period (inclusive)
    /// </summary>
    public DateOnly EndDate { get; set; }

    /// <summary>
    /// Current status of the pay period
    /// </summary>
    public PayPeriodStatus Status { get; set; } = PayPeriodStatus.Open;

    /// <summary>
    /// When the period was locked (if locked)
    /// </summary>
    public DateTime? LockedAt { get; set; }

    /// <summary>
    /// User who locked the period (if locked)
    /// </summary>
    public Guid? LockedById { get; set; }

    /// <summary>
    /// Optional notes about the pay period (e.g., why it was unlocked)
    /// </summary>
    public string? Notes { get; set; }

    /// <summary>
    /// When the period was processed for payroll export (if processed)
    /// </summary>
    public DateTime? ProcessedAt { get; set; }

    /// <summary>
    /// User who marked it as processed
    /// </summary>
    public Guid? ProcessedById { get; set; }

    // Navigation property
    public Employee? LockedBy { get; set; }
    public Employee? ProcessedBy { get; set; }

    /// <summary>
    /// Check if a date falls within this pay period
    /// </summary>
    public bool ContainsDate(DateOnly date)
    {
        return date >= StartDate && date <= EndDate;
    }

    /// <summary>
    /// Check if this period is currently locked (either Locked or Processed)
    /// </summary>
    public bool IsLocked => Status == PayPeriodStatus.Locked || Status == PayPeriodStatus.Processed;
}

/// <summary>
/// Status workflow for pay periods
/// </summary>
public enum PayPeriodStatus
{
    /// <summary>
    /// Period is open - time entries can be created and modified
    /// </summary>
    Open = 0,

    /// <summary>
    /// Period is locked - time entries cannot be modified
    /// </summary>
    Locked = 1,

    /// <summary>
    /// Period has been processed for payroll export
    /// </summary>
    Processed = 2
}
