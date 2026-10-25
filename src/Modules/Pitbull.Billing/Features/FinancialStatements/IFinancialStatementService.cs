using Pitbull.Core.CQRS;

namespace Pitbull.Billing.Features.FinancialStatements;

public interface IFinancialStatementService
{
    /// <summary>
    /// Generates a trial balance listing all accounts with debit/credit balances
    /// for posted journal entries in the given date range.
    /// </summary>
    Task<Result<TrialBalanceResult>> GetTrialBalanceAsync(
        DateOnly? periodStart = null,
        DateOnly? periodEnd = null,
        CancellationToken ct = default);

    /// <summary>
    /// Generates a balance sheet (Assets = Liabilities + Equity) as of a specific date.
    /// Uses all posted journal entries on or before the given date.
    /// </summary>
    Task<Result<BalanceSheetResult>> GetBalanceSheetAsync(
        DateOnly? asOfDate = null,
        CancellationToken ct = default);

    /// <summary>
    /// Generates an income statement (P&amp;L) showing Revenue - Expenses for a date range.
    /// </summary>
    Task<Result<IncomeStatementResult>> GetIncomeStatementAsync(
        DateOnly? periodStart = null,
        DateOnly? periodEnd = null,
        CancellationToken ct = default);
}
