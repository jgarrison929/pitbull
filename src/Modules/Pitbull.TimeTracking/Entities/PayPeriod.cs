using Pitbull.Core.Domain;

namespace Pitbull.TimeTracking.Entities;

/// <summary>
/// Represents a payroll period for time entry locking and closeout.
/// </summary>
public class PayPeriod : BaseEntity
{
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public PayPeriodStatus Status { get; set; } = PayPeriodStatus.Open;
    public string Name { get; set; } = string.Empty;
    public DateTime? LockedAt { get; set; }
    public Guid? LockedById { get; set; }
    public DateTime? PayrollExportMarkedAt { get; set; }

    public bool ContainsDate(DateOnly date) => date >= StartDate && date <= EndDate;

    public bool IsLocked => Status is PayPeriodStatus.Locked or PayPeriodStatus.Closed;
}

public enum PayPeriodStatus
{
    Open = 0,
    Locked = 1,
    Closed = 2,
}

