using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Features.BankReconciliation;

// ─── Bank Account DTOs ───────────────────────────────────────────

public record BankAccountDto(
    Guid Id,
    string AccountName,
    string BankName,
    string AccountNumberLast4,
    string? RoutingNumber,
    Guid GlAccountId,
    string? GlAccountNumber,
    string? GlAccountName,
    BankAccountType AccountType,
    bool IsActive,
    decimal OpeningBalance,
    DateOnly? OpeningBalanceDate,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record CreateBankAccountCommand(
    string AccountName,
    string BankName,
    string AccountNumberLast4,
    string? RoutingNumber,
    Guid GlAccountId,
    BankAccountType AccountType,
    decimal OpeningBalance,
    DateOnly? OpeningBalanceDate
) : ICommand<BankAccountDto>;

public record UpdateBankAccountCommand(
    Guid Id,
    string? AccountName,
    string? BankName,
    string? AccountNumberLast4,
    string? RoutingNumber,
    Guid? GlAccountId,
    bool? IsActive
) : ICommand<BankAccountDto>;

public record ListBankAccountsQuery(
    bool? IsActive = null,
    string? Search = null,
    int Page = 1,
    int PageSize = 25
) : IQuery<ListBankAccountsResult>;

public record ListBankAccountsResult(
    IReadOnlyList<BankAccountDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);

// ─── Bank Transaction DTOs ───────────────────────────────────────

public record BankTransactionDto(
    Guid Id,
    Guid BankAccountId,
    DateOnly TransactionDate,
    string Description,
    decimal Amount,
    string? CheckNumber,
    string? ReferenceNumber,
    BankTransactionType TransactionType,
    bool IsCleared,
    Guid? BankReconciliationId,
    Guid? MatchedJournalEntryId,
    DateTime? ClearedAt,
    DateTime CreatedAt
);

public record ImportBankTransactionsCommand(
    Guid BankAccountId,
    List<ImportBankTransactionLine> Lines
) : ICommand<ImportBankTransactionsResult>;

public record ImportBankTransactionLine(
    DateOnly TransactionDate,
    string Description,
    decimal Amount,
    string? CheckNumber,
    string? ReferenceNumber,
    BankTransactionType TransactionType
);

public record ImportBankTransactionsResult(
    int ImportedCount,
    int SkippedDuplicates
);

public record ListBankTransactionsQuery(
    Guid BankAccountId,
    bool? IsCleared = null,
    DateOnly? StartDate = null,
    DateOnly? EndDate = null,
    string? Search = null,
    int Page = 1,
    int PageSize = 50
) : IQuery<ListBankTransactionsResult>;

public record ListBankTransactionsResult(
    IReadOnlyList<BankTransactionDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);

// ─── Reconciliation DTOs ─────────────────────────────────────────

public record BankReconciliationDto(
    Guid Id,
    Guid BankAccountId,
    string? BankAccountName,
    DateOnly StatementDate,
    decimal StatementEndingBalance,
    decimal BeginningBalance,
    decimal ClearedDeposits,
    decimal ClearedWithdrawals,
    decimal Difference,
    BankReconciliationStatus Status,
    Guid? CompletedByUserId,
    DateTime? CompletedAt,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record StartReconciliationCommand(
    Guid BankAccountId,
    DateOnly StatementDate,
    decimal StatementEndingBalance
) : ICommand<BankReconciliationDto>;

public record MatchTransactionCommand(
    Guid ReconciliationId,
    Guid BankTransactionId,
    Guid? JournalEntryId = null
) : ICommand<BankReconciliationDto>;

public record UnmatchTransactionCommand(
    Guid ReconciliationId,
    Guid BankTransactionId
) : ICommand<BankReconciliationDto>;

public record CompleteReconciliationCommand(
    Guid ReconciliationId,
    Guid CompletedByUserId
) : ICommand<BankReconciliationDto>;

public record ListReconciliationsQuery(
    Guid? BankAccountId = null,
    BankReconciliationStatus? Status = null,
    int Page = 1,
    int PageSize = 25
) : IQuery<ListReconciliationsResult>;

public record ListReconciliationsResult(
    IReadOnlyList<BankReconciliationDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);
