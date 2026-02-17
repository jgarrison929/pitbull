using Pitbull.Core.Domain;

namespace Pitbull.Contracts.Domain;

/// <summary>
/// Dual-book accounting entry per payment application.
/// Tracks GAAP and Bonus/Job Cost projections separately.
/// </summary>
public class PaymentApplicationBookEntry : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid PaymentApplicationId { get; set; }

    public AccountingBookType BookType { get; set; }

    public decimal EarnedRevenueToDate { get; set; }
    public decimal CurrentPeriodRevenue { get; set; }
    public decimal BillingsToDate { get; set; }
    public decimal CurrentPeriodBilling { get; set; }
    public decimal RetainageHeldToDate { get; set; }
    public decimal OverUnderBilling { get; set; }

    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public PaymentApplication? PaymentApplication { get; set; }
}
