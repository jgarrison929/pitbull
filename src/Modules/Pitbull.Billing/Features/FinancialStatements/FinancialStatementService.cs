using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Features.FinancialStatements;

public class FinancialStatementService(
    PitbullDbContext db,
    ILogger<FinancialStatementService> logger) : IFinancialStatementService
{
    public async Task<Result<TrialBalanceResult>> GetTrialBalanceAsync(
        DateOnly? periodStart = null,
        DateOnly? periodEnd = null,
        CancellationToken ct = default)
    {
        try
        {
            // Default to current fiscal year if no dates provided
            var end = periodEnd ?? DateOnly.FromDateTime(DateTime.UtcNow);
            var start = periodStart ?? new DateOnly(end.Year, 1, 1);

            // Get all active GL accounts
            var accounts = await db.Set<ChartOfAccount>()
                .AsNoTracking()
                .Where(a => a.IsActive)
                .OrderBy(a => a.AccountNumber)
                .ToListAsync(ct);

            // Get aggregated balances from posted journal entry lines
            var balances = await db.Set<JournalEntryLine>()
                .AsNoTracking()
                .Where(l =>
                    l.JournalEntry.Status == JournalEntryStatus.Posted &&
                    l.JournalEntry.EntryDate >= start &&
                    l.JournalEntry.EntryDate <= end)
                .GroupBy(l => l.GlAccountId)
                .Select(g => new
                {
                    AccountId = g.Key,
                    TotalDebits = g.Sum(l => l.DebitAmount),
                    TotalCredits = g.Sum(l => l.CreditAmount)
                })
                .ToListAsync(ct);

            var balanceMap = balances.ToDictionary(b => b.AccountId);

            var lineItems = new List<TrialBalanceLineItem>();
            decimal totalDebits = 0;
            decimal totalCredits = 0;

            foreach (var account in accounts)
            {
                var bal = balanceMap.GetValueOrDefault(account.Id);
                if (bal is null) continue; // Skip accounts with no activity

                decimal netDebit;
                decimal netCredit;

                // Present balance according to normal balance convention
                decimal netAmount = bal.TotalDebits - bal.TotalCredits;

                if (netAmount >= 0)
                {
                    netDebit = netAmount;
                    netCredit = 0;
                }
                else
                {
                    netDebit = 0;
                    netCredit = Math.Abs(netAmount);
                }

                lineItems.Add(new TrialBalanceLineItem(
                    AccountId: account.Id,
                    AccountNumber: account.AccountNumber,
                    AccountName: account.AccountName,
                    AccountType: account.AccountType,
                    AccountTypeName: account.AccountType.ToString(),
                    NormalBalance: account.NormalBalance,
                    DebitBalance: netDebit,
                    CreditBalance: netCredit
                ));

                totalDebits += netDebit;
                totalCredits += netCredit;
            }

            return Result.Success(new TrialBalanceResult(
                Accounts: lineItems,
                TotalDebits: totalDebits,
                TotalCredits: totalCredits,
                IsBalanced: totalDebits == totalCredits,
                PeriodStart: start,
                PeriodEnd: end,
                GeneratedAt: DateTime.UtcNow
            ));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to generate trial balance");
            return Result.Failure<TrialBalanceResult>("Failed to generate trial balance", "DATABASE_ERROR");
        }
    }

    public async Task<Result<BalanceSheetResult>> GetBalanceSheetAsync(
        DateOnly? asOfDate = null,
        CancellationToken ct = default)
    {
        try
        {
            var date = asOfDate ?? DateOnly.FromDateTime(DateTime.UtcNow);

            // Get all active GL accounts (Asset, Liability, Equity only)
            var accounts = await db.Set<ChartOfAccount>()
                .AsNoTracking()
                .Where(a => a.IsActive &&
                    (a.AccountType == AccountType.Asset ||
                     a.AccountType == AccountType.Liability ||
                     a.AccountType == AccountType.Equity))
                .OrderBy(a => a.AccountNumber)
                .ToListAsync(ct);

            // Get cumulative balances from all posted journal entry lines up to date
            var balances = await db.Set<JournalEntryLine>()
                .AsNoTracking()
                .Where(l =>
                    l.JournalEntry.Status == JournalEntryStatus.Posted &&
                    l.JournalEntry.EntryDate <= date)
                .GroupBy(l => l.GlAccountId)
                .Select(g => new
                {
                    AccountId = g.Key,
                    TotalDebits = g.Sum(l => l.DebitAmount),
                    TotalCredits = g.Sum(l => l.CreditAmount)
                })
                .ToListAsync(ct);

            var balanceMap = balances.ToDictionary(
                b => b.AccountId,
                b => new AccountBalance(b.TotalDebits, b.TotalCredits));

            // Build hierarchical sections
            var assetAccounts = accounts.Where(a => a.AccountType == AccountType.Asset).ToList();
            var liabilityAccounts = accounts.Where(a => a.AccountType == AccountType.Liability).ToList();
            var equityAccounts = accounts.Where(a => a.AccountType == AccountType.Equity).ToList();

            // Include net income in equity for balance sheet purposes
            decimal netIncome = await CalculateNetIncomeAsync(null, date, ct);

            var assetsSection = BuildBalanceSheetSection("Assets", AccountType.Asset, assetAccounts, balanceMap);
            var liabilitiesSection = BuildBalanceSheetSection("Liabilities", AccountType.Liability, liabilityAccounts, balanceMap);
            var equitySection = BuildBalanceSheetSection("Equity", AccountType.Equity, equityAccounts, balanceMap);

            // Adjust equity total to include current-period net income (retained earnings)
            var adjustedEquitySection = equitySection with
            {
                Total = equitySection.Total + netIncome
            };

            decimal totalLiabilitiesAndEquity = liabilitiesSection.Total + adjustedEquitySection.Total;

            return Result.Success(new BalanceSheetResult(
                Assets: assetsSection,
                Liabilities: liabilitiesSection,
                Equity: adjustedEquitySection,
                TotalLiabilitiesAndEquity: totalLiabilitiesAndEquity,
                IsBalanced: assetsSection.Total == totalLiabilitiesAndEquity,
                AsOfDate: date,
                GeneratedAt: DateTime.UtcNow
            ));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to generate balance sheet");
            return Result.Failure<BalanceSheetResult>("Failed to generate balance sheet", "DATABASE_ERROR");
        }
    }

    public async Task<Result<IncomeStatementResult>> GetIncomeStatementAsync(
        DateOnly? periodStart = null,
        DateOnly? periodEnd = null,
        CancellationToken ct = default)
    {
        try
        {
            var end = periodEnd ?? DateOnly.FromDateTime(DateTime.UtcNow);
            var start = periodStart ?? new DateOnly(end.Year, 1, 1);

            // Get all active Revenue and Expense accounts
            var accounts = await db.Set<ChartOfAccount>()
                .AsNoTracking()
                .Where(a => a.IsActive &&
                    (a.AccountType == AccountType.Revenue ||
                     a.AccountType == AccountType.Expense))
                .OrderBy(a => a.AccountNumber)
                .ToListAsync(ct);

            // Get balances for the period
            var balances = await db.Set<JournalEntryLine>()
                .AsNoTracking()
                .Where(l =>
                    l.JournalEntry.Status == JournalEntryStatus.Posted &&
                    l.JournalEntry.EntryDate >= start &&
                    l.JournalEntry.EntryDate <= end)
                .GroupBy(l => l.GlAccountId)
                .Select(g => new
                {
                    AccountId = g.Key,
                    TotalDebits = g.Sum(l => l.DebitAmount),
                    TotalCredits = g.Sum(l => l.CreditAmount)
                })
                .ToListAsync(ct);

            var balanceMap = balances.ToDictionary(
                b => b.AccountId,
                b => new AccountBalance(b.TotalDebits, b.TotalCredits));

            var revenueAccounts = accounts.Where(a => a.AccountType == AccountType.Revenue).ToList();
            var expenseAccounts = accounts.Where(a => a.AccountType == AccountType.Expense).ToList();

            var revenueSection = BuildIncomeStatementSection("Revenue", AccountType.Revenue, revenueAccounts, balanceMap);
            var expenseSection = BuildIncomeStatementSection("Expenses", AccountType.Expense, expenseAccounts, balanceMap);

            decimal netIncome = revenueSection.Total - expenseSection.Total;

            return Result.Success(new IncomeStatementResult(
                Revenue: revenueSection,
                Expenses: expenseSection,
                NetIncome: netIncome,
                PeriodStart: start,
                PeriodEnd: end,
                GeneratedAt: DateTime.UtcNow
            ));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to generate income statement");
            return Result.Failure<IncomeStatementResult>("Failed to generate income statement", "DATABASE_ERROR");
        }
    }

    // ── Private helpers ──

    private async Task<decimal> CalculateNetIncomeAsync(DateOnly? periodStart, DateOnly asOfDate, CancellationToken ct)
    {
        // Get the start of the fiscal year if not specified
        var start = periodStart ?? new DateOnly(asOfDate.Year, 1, 1);

        // Get revenue and expense account IDs
        var revenueAccountIds = await db.Set<ChartOfAccount>()
            .AsNoTracking()
            .Where(a => a.AccountType == AccountType.Revenue)
            .Select(a => a.Id)
            .ToListAsync(ct);

        var expenseAccountIds = await db.Set<ChartOfAccount>()
            .AsNoTracking()
            .Where(a => a.AccountType == AccountType.Expense)
            .Select(a => a.Id)
            .ToListAsync(ct);

        // Get posted journal entry lines in the period
        var lines = await db.Set<JournalEntryLine>()
            .AsNoTracking()
            .Where(l =>
                l.JournalEntry.Status == JournalEntryStatus.Posted &&
                l.JournalEntry.EntryDate >= start &&
                l.JournalEntry.EntryDate <= asOfDate &&
                (revenueAccountIds.Contains(l.GlAccountId) || expenseAccountIds.Contains(l.GlAccountId)))
            .Select(l => new { l.GlAccountId, l.DebitAmount, l.CreditAmount })
            .ToListAsync(ct);

        // Revenue: credit-normal → balance = credits - debits
        decimal revenueBalance = lines
            .Where(l => revenueAccountIds.Contains(l.GlAccountId))
            .Sum(l => l.CreditAmount - l.DebitAmount);

        // Expenses: debit-normal → balance = debits - credits
        decimal expenseBalance = lines
            .Where(l => expenseAccountIds.Contains(l.GlAccountId))
            .Sum(l => l.DebitAmount - l.CreditAmount);

        return revenueBalance - expenseBalance;
    }

    private static BalanceSheetSection BuildBalanceSheetSection(
        string sectionName,
        AccountType accountType,
        IReadOnlyList<ChartOfAccount> accounts,
        IReadOnlyDictionary<Guid, AccountBalance> balanceMap)
    {
        var childrenByParent = accounts
            .Where(a => a.ParentAccountId.HasValue)
            .GroupBy(a => a.ParentAccountId!.Value)
            .ToDictionary(g => g.Key, g => g.OrderBy(a => a.AccountNumber).ToList());

        var roots = accounts
            .Where(a => !a.ParentAccountId.HasValue ||
                        !accounts.Any(other => other.Id == a.ParentAccountId.Value))
            .OrderBy(a => a.AccountNumber)
            .ToList();

        var lines = roots
            .Select(a => BuildBalanceSheetAccountLine(a, accountType, childrenByParent, balanceMap))
            .Where(l => l.Balance != 0 || l.Children.Count > 0)
            .ToList();

        decimal total = lines.Sum(l => l.Balance);

        return new BalanceSheetSection(sectionName, accountType, lines, total);
    }

    private static BalanceSheetAccountLine BuildBalanceSheetAccountLine(
        ChartOfAccount account,
        AccountType accountType,
        IReadOnlyDictionary<Guid, List<ChartOfAccount>> childrenByParent,
        IReadOnlyDictionary<Guid, AccountBalance> balanceMap)
    {
        var children = childrenByParent.TryGetValue(account.Id, out var childList)
            ? childList
                .Select(child => BuildBalanceSheetAccountLine(child, accountType, childrenByParent, balanceMap))
                .Where(c => c.Balance != 0 || c.Children.Count > 0)
                .ToList()
            : new List<BalanceSheetAccountLine>();

        decimal ownBalance = CalculateNaturalBalance(account, balanceMap);
        decimal totalBalance = ownBalance + children.Sum(c => c.Balance);

        return new BalanceSheetAccountLine(
            AccountId: account.Id,
            AccountNumber: account.AccountNumber,
            AccountName: account.AccountName,
            Balance: totalBalance,
            Children: children
        );
    }

    private static IncomeStatementSection BuildIncomeStatementSection(
        string sectionName,
        AccountType accountType,
        IReadOnlyList<ChartOfAccount> accounts,
        IReadOnlyDictionary<Guid, AccountBalance> balanceMap)
    {
        var childrenByParent = accounts
            .Where(a => a.ParentAccountId.HasValue)
            .GroupBy(a => a.ParentAccountId!.Value)
            .ToDictionary(g => g.Key, g => g.OrderBy(a => a.AccountNumber).ToList());

        var roots = accounts
            .Where(a => !a.ParentAccountId.HasValue ||
                        !accounts.Any(other => other.Id == a.ParentAccountId.Value))
            .OrderBy(a => a.AccountNumber)
            .ToList();

        var lines = roots
            .Select(a => BuildIncomeStatementAccountLine(a, accountType, childrenByParent, balanceMap))
            .Where(l => l.Balance != 0 || l.Children.Count > 0)
            .ToList();

        decimal total = lines.Sum(l => l.Balance);

        return new IncomeStatementSection(sectionName, accountType, lines, total);
    }

    private static IncomeStatementAccountLine BuildIncomeStatementAccountLine(
        ChartOfAccount account,
        AccountType accountType,
        IReadOnlyDictionary<Guid, List<ChartOfAccount>> childrenByParent,
        IReadOnlyDictionary<Guid, AccountBalance> balanceMap)
    {
        var children = childrenByParent.TryGetValue(account.Id, out var childList)
            ? childList
                .Select(child => BuildIncomeStatementAccountLine(child, accountType, childrenByParent, balanceMap))
                .Where(c => c.Balance != 0 || c.Children.Count > 0)
                .ToList()
            : new List<IncomeStatementAccountLine>();

        decimal ownBalance = CalculateNaturalBalance(account, balanceMap);
        decimal totalBalance = ownBalance + children.Sum(c => c.Balance);

        return new IncomeStatementAccountLine(
            AccountId: account.Id,
            AccountNumber: account.AccountNumber,
            AccountName: account.AccountName,
            Balance: totalBalance,
            Children: children
        );
    }

    /// <summary>
    /// Calculates the natural balance for an account based on its normal balance convention.
    /// Debit-normal accounts (Assets, Expenses): balance = debits - credits
    /// Credit-normal accounts (Liabilities, Equity, Revenue): balance = credits - debits
    /// </summary>
    private static decimal CalculateNaturalBalance(
        ChartOfAccount account,
        IReadOnlyDictionary<Guid, AccountBalance> balanceMap)
    {
        if (!balanceMap.TryGetValue(account.Id, out var bal))
            return 0;

        return account.NormalBalance == NormalBalance.Debit
            ? bal.TotalDebits - bal.TotalCredits
            : bal.TotalCredits - bal.TotalDebits;
    }

    /// <summary>
    /// Helper type to hold aggregated account balances from the query result.
    /// Maps from the anonymous type returned by EF Core GroupBy.
    /// </summary>
    private record AccountBalance(decimal TotalDebits, decimal TotalCredits);
}
