using Pitbull.Core.Domain;

namespace Pitbull.Payroll.Domain;

/// <summary>
/// Groups payroll entries for processing. One batch per pay period per run.
/// </summary>
public class PayrollBatch : BaseEntity
{
    public Guid PayPeriodId { get; set; }
    public string BatchNumber { get; set; } = string.Empty;
    public PayrollBatchStatus Status { get; set; } = PayrollBatchStatus.Draft;
    
    // Totals (calculated)
    public decimal TotalRegularHours { get; set; }
    public decimal TotalOvertimeHours { get; set; }
    public decimal TotalDoubleTimeHours { get; set; }
    public decimal TotalGrossPay { get; set; }
    public decimal TotalDeductions { get; set; }
    public decimal TotalNetPay { get; set; }
    public decimal TotalEmployerTaxes { get; set; }
    public decimal TotalUnionFringes { get; set; }
    public decimal TotalEmployerCost { get; set; }
    
    public int EmployeeCount { get; set; }
    
    public new string? CreatedBy { get; set; }
    public string? CalculatedBy { get; set; }
    public DateTime? CalculatedAt { get; set; }
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? PostedBy { get; set; }
    public DateTime? PostedAt { get; set; }
    public string? Notes { get; set; }
    
    public PayPeriod PayPeriod { get; set; } = null!;
    public ICollection<PayrollEntry> Entries { get; set; } = new List<PayrollEntry>();
}

public enum PayrollBatchStatus
{
    Draft = 1,       // Created, not calculated
    Calculated = 2,  // Payroll calculated, ready for review
    Approved = 3,    // Approved, ready for posting
    Posted = 4,      // Posted to GL
    Voided = 5       // Voided (correction needed)
}
