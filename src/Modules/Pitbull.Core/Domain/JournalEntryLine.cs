namespace Pitbull.Core.Domain;

/// <summary>
/// Individual debit or credit line within a journal entry.
/// Carries dimensional tags for job cost drill-down.
/// </summary>
public class JournalEntryLine : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }

    public Guid JournalEntryId { get; set; }
    public JournalEntry JournalEntry { get; set; } = null!;

    public int LineNumber { get; set; }

    /// <summary>Target GL account.</summary>
    public Guid GlAccountId { get; set; }

    /// <summary>Zero if this is a credit line.</summary>
    public decimal DebitAmount { get; set; }

    /// <summary>Zero if this is a debit line.</summary>
    public decimal CreditAmount { get; set; }

    public string? Description { get; set; }

    // Dimensional tags for job costing
    public Guid? ProjectId { get; set; }
    public Guid? CostCodeId { get; set; }
}
