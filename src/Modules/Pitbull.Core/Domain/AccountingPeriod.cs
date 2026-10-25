namespace Pitbull.Core.Domain;

/// <summary>
/// Fiscal accounting period that controls when postings are allowed.
/// </summary>
public class AccountingPeriod : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }

    /// <summary>Sequential period within the fiscal year (1-12).</summary>
    public int PeriodNumber { get; set; }

    /// <summary>Fiscal year (e.g., 2026).</summary>
    public int FiscalYear { get; set; }

    /// <summary>Display name (e.g., "January 2026").</summary>
    public string PeriodName { get; set; } = string.Empty;

    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }

    public PeriodStatus Status { get; set; } = PeriodStatus.Open;

    public Guid? ClosedByUserId { get; set; }
    public DateTime? ClosedAt { get; set; }

    /// <summary>Number of times this period has been reopened (audit concern if > 0).</summary>
    public int ReopenedCount { get; set; }
    public DateTime? LastReopenedAt { get; set; }
    public string? LastReopenReason { get; set; }
}

public enum PeriodStatus
{
    Open = 1,
    SoftClosed = 2,
    HardClosed = 3
}
