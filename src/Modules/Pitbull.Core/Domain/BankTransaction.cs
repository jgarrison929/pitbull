namespace Pitbull.Core.Domain;

/// <summary>
/// A single line from a bank statement, imported via CSV.
/// Matched to journal entry lines during reconciliation.
/// </summary>
public class BankTransaction : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }

    public Guid BankAccountId { get; set; }
    public BankAccount BankAccount { get; set; } = null!;

    public DateOnly TransactionDate { get; set; }
    public string Description { get; set; } = string.Empty;

    /// <summary>Positive = deposit/credit, Negative = withdrawal/debit.</summary>
    public decimal Amount { get; set; }

    public string? CheckNumber { get; set; }
    public string? ReferenceNumber { get; set; }

    public BankTransactionType TransactionType { get; set; } = BankTransactionType.Other;

    /// <summary>Whether this transaction has been matched during reconciliation.</summary>
    public bool IsCleared { get; set; }

    /// <summary>FK to the reconciliation session where this was cleared.</summary>
    public Guid? BankReconciliationId { get; set; }
    public BankReconciliation? BankReconciliation { get; set; }

    /// <summary>FK to the matched journal entry line (optional — for audit trail).</summary>
    public Guid? MatchedJournalEntryId { get; set; }

    public DateTime? ClearedAt { get; set; }
}

public enum BankTransactionType
{
    Check = 1,
    Deposit = 2,
    Transfer = 3,
    Fee = 4,
    Interest = 5,
    Other = 6
}
