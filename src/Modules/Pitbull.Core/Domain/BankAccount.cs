namespace Pitbull.Core.Domain;

/// <summary>
/// Company bank account linked to a GL cash account.
/// Used for bank reconciliation — matching bank statement lines to journal entries.
/// </summary>
public class BankAccount : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }

    public string AccountName { get; set; } = string.Empty;
    public string BankName { get; set; } = string.Empty;

    /// <summary>Last 4 digits only — full number should not be stored.</summary>
    public string AccountNumberLast4 { get; set; } = string.Empty;

    public string? RoutingNumber { get; set; }

    /// <summary>FK to ChartOfAccount — the GL cash account this bank account maps to.</summary>
    public Guid GlAccountId { get; set; }

    public BankAccountType AccountType { get; set; } = BankAccountType.Checking;
    public bool IsActive { get; set; } = true;

    /// <summary>Opening balance when the account was first set up in the system.</summary>
    public decimal OpeningBalance { get; set; }

    public DateOnly? OpeningBalanceDate { get; set; }

    // Navigation
    public List<BankTransaction> Transactions { get; set; } = [];
    public List<BankReconciliation> Reconciliations { get; set; } = [];
}

public enum BankAccountType
{
    Checking = 1,
    Savings = 2,
    MoneyMarket = 3
}
