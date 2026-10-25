using Pitbull.Core.CQRS;

namespace Pitbull.Billing.Features.BankReconciliation;

public interface IBankReconciliationService
{
    // Bank Accounts
    Task<Result<ListBankAccountsResult>> ListBankAccountsAsync(ListBankAccountsQuery query, CancellationToken ct = default);
    Task<Result<BankAccountDto>> GetBankAccountAsync(Guid id, CancellationToken ct = default);
    Task<Result<BankAccountDto>> CreateBankAccountAsync(CreateBankAccountCommand command, CancellationToken ct = default);
    Task<Result<BankAccountDto>> UpdateBankAccountAsync(UpdateBankAccountCommand command, CancellationToken ct = default);
    Task<Result> DeleteBankAccountAsync(Guid id, CancellationToken ct = default);

    // Bank Transactions
    Task<Result<ListBankTransactionsResult>> ListBankTransactionsAsync(ListBankTransactionsQuery query, CancellationToken ct = default);
    Task<Result<ImportBankTransactionsResult>> ImportTransactionsAsync(ImportBankTransactionsCommand command, CancellationToken ct = default);
    Task<Result> DeleteBankTransactionAsync(Guid id, CancellationToken ct = default);

    // Reconciliation
    Task<Result<ListReconciliationsResult>> ListReconciliationsAsync(ListReconciliationsQuery query, CancellationToken ct = default);
    Task<Result<BankReconciliationDto>> GetReconciliationAsync(Guid id, CancellationToken ct = default);
    Task<Result<BankReconciliationDto>> StartReconciliationAsync(StartReconciliationCommand command, CancellationToken ct = default);
    Task<Result<BankReconciliationDto>> MatchTransactionAsync(MatchTransactionCommand command, CancellationToken ct = default);
    Task<Result<BankReconciliationDto>> UnmatchTransactionAsync(UnmatchTransactionCommand command, CancellationToken ct = default);
    Task<Result<BankReconciliationDto>> CompleteReconciliationAsync(CompleteReconciliationCommand command, CancellationToken ct = default);
}
