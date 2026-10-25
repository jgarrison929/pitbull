namespace Pitbull.Contracts.Domain;

/// <summary>
/// Determines which accounting book views are generated for a payment application.
/// </summary>
public enum AccountingBookMode
{
    Gaap = 0,
    BonusJobCost = 1,
    Both = 2
}

/// <summary>
/// Type of accounting book entry.
/// </summary>
public enum AccountingBookType
{
    GAAP = 0,
    BonusJobCost = 1
}
