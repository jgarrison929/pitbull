using Pitbull.Core.Domain;

namespace Pitbull.Payroll.Domain;

/// <summary>
/// Defines a payroll processing window.
/// </summary>
public class PayPeriod : BaseEntity
{
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public DateOnly PayDate { get; set; }
    public PayFrequency Frequency { get; set; }
    public PayPeriodStatus Status { get; set; } = PayPeriodStatus.Open;
    
    public string? ProcessedBy { get; set; }
    public DateTime? ProcessedAt { get; set; }
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? Notes { get; set; }
    
    public ICollection<PayrollBatch> Batches { get; set; } = new List<PayrollBatch>();
}

public enum PayFrequency
{
    Weekly = 1,
    BiWeekly = 2,
    SemiMonthly = 3,
    Monthly = 4
}

public enum PayPeriodStatus
{
    Open = 1,        // Accepting time entries
    Processing = 2,  // Payroll calculation in progress
    Approved = 3,    // Ready for payment
    Closed = 4       // Posted to GL, locked
}
