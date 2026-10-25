namespace Pitbull.Core.Domain;

/// <summary>
/// General ledger chart of accounts master entity.
/// </summary>
public class ChartOfAccount : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }

    public string AccountNumber { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public AccountType AccountType { get; set; }

    public Guid? ParentAccountId { get; set; }
    public ChartOfAccount? ParentAccount { get; set; }
    public List<ChartOfAccount> ChildAccounts { get; set; } = [];

    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public NormalBalance NormalBalance { get; set; }
    public Guid? DepartmentId { get; set; }
    public bool IsSubledgerControl { get; set; } = false;
}

public enum AccountType
{
    Asset = 1,
    Liability = 2,
    Equity = 3,
    Revenue = 4,
    Expense = 5
}

public enum NormalBalance
{
    Debit = 1,
    Credit = 2
}
