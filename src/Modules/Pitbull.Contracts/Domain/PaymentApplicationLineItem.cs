using Pitbull.Core.Domain;

namespace Pitbull.Contracts.Domain;

/// <summary>
/// G703 continuation sheet line item — snapshot of SOV line item progress
/// for a specific payment application billing period.
/// </summary>
public class PaymentApplicationLineItem : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid PaymentApplicationId { get; set; }
    public Guid SOVLineItemId { get; set; }

    // Snapshot from SOV line item at time of pay app creation
    public string ItemNumber { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal ScheduledValue { get; set; }

    // Work completed
    public decimal WorkCompletedPrevious { get; set; }
    public decimal WorkCompletedThisPeriod { get; set; }

    // Materials stored
    public decimal MaterialsStoredPrevious { get; set; }
    public decimal MaterialsStoredThisPeriod { get; set; }
    public decimal MaterialsStoredToDate { get; set; }

    // Computed totals
    public decimal TotalCompletedAndStoredToDate { get; set; }
    public decimal PercentComplete { get; set; }
    public decimal BalanceToFinish { get; set; }

    // Retainage
    public decimal RetainagePercent { get; set; }
    public decimal RetainageAmount { get; set; }

    // Display order
    public int SortOrder { get; set; }

    // Navigation
    public PaymentApplication? PaymentApplication { get; set; }
    public SOVLineItem? SOVLineItem { get; set; }
}
