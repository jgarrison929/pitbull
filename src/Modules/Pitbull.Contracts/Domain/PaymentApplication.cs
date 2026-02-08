using Pitbull.Core.Domain;

namespace Pitbull.Contracts.Domain;

/// <summary>
/// Payment application (pay app) submitted by subcontractor for work completed.
/// Tracks billing progress against subcontract value.
/// </summary>
public class PaymentApplication : BaseEntity
{
    public Guid SubcontractId { get; set; }
    public int ApplicationNumber { get; set; } // Sequential: 1, 2, 3...
    
    // Billing period
    public DateTime PeriodStart { get; set; }
    public DateTime PeriodEnd { get; set; }
    
    // Amounts
    public decimal ScheduledValue { get; set; } // Contract value at time of application
    public decimal WorkCompletedPrevious { get; set; } // Billed in prior applications
    public decimal WorkCompletedThisPeriod { get; set; } // New work this period
    public decimal WorkCompletedToDate { get; set; } // Total work completed
    public decimal StoredMaterials { get; set; } // Materials on site not yet installed
    public decimal TotalCompletedAndStored { get; set; } // Work + stored materials
    
    // Retainage
    public decimal RetainagePercent { get; set; }
    public decimal RetainageThisPeriod { get; set; }
    public decimal RetainagePrevious { get; set; }
    public decimal TotalRetainage { get; set; }
    
    // Net amounts
    public decimal TotalEarnedLessRetainage { get; set; }
    public decimal LessPreviousCertificates { get; set; } // Previously certified amounts
    public decimal CurrentPaymentDue { get; set; } // Amount due this application
    
    // Status
    public PaymentApplicationStatus Status { get; set; } = PaymentApplicationStatus.Draft;
    
    // Dates
    public DateTime? SubmittedDate { get; set; }
    public DateTime? ReviewedDate { get; set; }
    public DateTime? ApprovedDate { get; set; }
    public DateTime? PaidDate { get; set; }
    
    // Approval
    public string? ApprovedBy { get; set; }
    public decimal? ApprovedAmount { get; set; } // May differ from requested
    public string? Notes { get; set; }
    
    // Reference
    public string? InvoiceNumber { get; set; } // Sub's invoice reference
    public string? CheckNumber { get; set; } // Payment reference
    
    // Navigation
    public Subcontract? Subcontract { get; set; }
}
