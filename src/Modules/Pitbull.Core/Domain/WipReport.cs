namespace Pitbull.Core.Domain;

public class WipReport : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public DateOnly ReportDate { get; set; }
    public int FiscalYear { get; set; }
    public int PeriodNumber { get; set; }
    public WipReportStatus Status { get; set; } = WipReportStatus.Draft;
    public string GeneratedById { get; set; } = string.Empty;

    /// <summary>FK to the journal entry created when this report was posted to GL. Null = not posted.</summary>
    public Guid? GlJournalEntryId { get; set; }

    /// <summary>When this report was posted to GL.</summary>
    public DateTime? PostedToGlAt { get; set; }

    /// <summary>User who posted to GL.</summary>
    public string? PostedToGlBy { get; set; }

    public List<WipReportLine> Lines { get; set; } = [];
}

public class WipReportLine : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid WipReportId { get; set; }
    public Guid ProjectId { get; set; }

    public decimal ContractAmount { get; set; }
    public decimal ApprovedChangeOrders { get; set; }
    public decimal RevisedContractAmount { get; set; }
    public decimal TotalCostToDate { get; set; }
    public decimal EstimatedCostToComplete { get; set; }
    public decimal EstimatedTotalCost { get; set; }
    public decimal PercentComplete { get; set; }
    public decimal EarnedRevenue { get; set; }
    public decimal BilledToDate { get; set; }
    public decimal OverUnderBilling { get; set; }

    public WipReport? WipReport { get; set; }
}

public enum WipReportStatus
{
    Draft = 1,
    Final = 2
}
