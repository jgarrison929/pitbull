namespace Pitbull.Core.Domain;

/// <summary>
/// A bank reconciliation session. The controller works through this to match
/// bank statement lines to journal entries until the difference is zero.
/// </summary>
public class BankReconciliation : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }

    public Guid BankAccountId { get; set; }
    public BankAccount BankAccount { get; set; } = null!;

    /// <summary>Statement date (end of period being reconciled).</summary>
    public DateOnly StatementDate { get; set; }

    /// <summary>Ending balance per the bank statement.</summary>
    public decimal StatementEndingBalance { get; set; }

    /// <summary>Beginning GL balance for this reconciliation period.</summary>
    public decimal BeginningBalance { get; set; }

    /// <summary>Sum of cleared deposits.</summary>
    public decimal ClearedDeposits { get; set; }

    /// <summary>Sum of cleared withdrawals (stored as positive).</summary>
    public decimal ClearedWithdrawals { get; set; }

    /// <summary>
    /// Difference = StatementEndingBalance - (BeginningBalance + ClearedDeposits - ClearedWithdrawals).
    /// When zero, reconciliation balances.
    /// </summary>
    public decimal Difference { get; set; }

    public BankReconciliationStatus Status { get; set; } = BankReconciliationStatus.InProgress;

    public Guid? CompletedByUserId { get; set; }
    public DateTime? CompletedAt { get; set; }

    // Navigation
    public List<BankTransaction> ClearedTransactions { get; set; } = [];
}

public enum BankReconciliationStatus
{
    InProgress = 1,
    Completed = 2
}
