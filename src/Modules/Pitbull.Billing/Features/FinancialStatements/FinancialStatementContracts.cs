using Pitbull.Core.Domain;

namespace Pitbull.Billing.Features.FinancialStatements;

// ── Trial Balance ──

public record TrialBalanceLineItem(
    Guid AccountId,
    string AccountNumber,
    string AccountName,
    AccountType AccountType,
    string AccountTypeName,
    NormalBalance NormalBalance,
    decimal DebitBalance,
    decimal CreditBalance
);

public record TrialBalanceResult(
    IReadOnlyList<TrialBalanceLineItem> Accounts,
    decimal TotalDebits,
    decimal TotalCredits,
    bool IsBalanced,
    DateOnly? PeriodStart,
    DateOnly? PeriodEnd,
    DateTime GeneratedAt
);

// ── Balance Sheet ──

public record BalanceSheetAccountLine(
    Guid AccountId,
    string AccountNumber,
    string AccountName,
    decimal Balance,
    IReadOnlyList<BalanceSheetAccountLine> Children
);

public record BalanceSheetSection(
    string SectionName,
    AccountType AccountType,
    IReadOnlyList<BalanceSheetAccountLine> Accounts,
    decimal Total
);

public record BalanceSheetResult(
    BalanceSheetSection Assets,
    BalanceSheetSection Liabilities,
    BalanceSheetSection Equity,
    decimal TotalLiabilitiesAndEquity,
    bool IsBalanced,
    DateOnly AsOfDate,
    DateTime GeneratedAt
);

// ── Income Statement (Profit & Loss) ──

public record IncomeStatementAccountLine(
    Guid AccountId,
    string AccountNumber,
    string AccountName,
    decimal Balance,
    IReadOnlyList<IncomeStatementAccountLine> Children
);

public record IncomeStatementSection(
    string SectionName,
    AccountType AccountType,
    IReadOnlyList<IncomeStatementAccountLine> Accounts,
    decimal Total
);

public record IncomeStatementResult(
    IncomeStatementSection Revenue,
    IncomeStatementSection Expenses,
    decimal NetIncome,
    DateOnly PeriodStart,
    DateOnly PeriodEnd,
    DateTime GeneratedAt
);
