using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using BankRecEntity = global::Pitbull.Core.Domain.BankReconciliation;

namespace Pitbull.Billing.Features.BankReconciliation;

public class BankReconciliationService(PitbullDbContext db, ILogger<BankReconciliationService> logger) : IBankReconciliationService
{
    // ─── Bank Accounts ───────────────────────────────────────────

    public async Task<Result<ListBankAccountsResult>> ListBankAccountsAsync(ListBankAccountsQuery query, CancellationToken ct = default)
    {
        IQueryable<BankAccount> q = db.BankAccounts.AsNoTracking();

        if (query.IsActive.HasValue)
            q = q.Where(a => a.IsActive == query.IsActive.Value);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            string term = query.Search.Trim().ToLower();
            q = q.Where(a => a.AccountName.ToLower().Contains(term) || a.BankName.ToLower().Contains(term));
        }

        int totalCount = await q.CountAsync(ct);
        int page = Math.Max(1, query.Page);
        int pageSize = Math.Clamp(query.PageSize, 1, 100);

        var items = await q
            .OrderBy(a => a.AccountName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        // Look up GL account info for display
        var glAccountIds = items.Select(a => a.GlAccountId).Distinct().ToList();
        var glAccounts = await db.Set<ChartOfAccount>()
            .AsNoTracking()
            .Where(c => glAccountIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, ct);

        int totalPages = (int)Math.Ceiling((double)totalCount / pageSize);
        return Result.Success(new ListBankAccountsResult(
            Items: items.Select(a => MapBankAccountDto(a, glAccounts)).ToList(),
            TotalCount: totalCount,
            Page: page,
            PageSize: pageSize,
            TotalPages: totalPages));
    }

    public async Task<Result<BankAccountDto>> GetBankAccountAsync(Guid id, CancellationToken ct = default)
    {
        var account = await db.BankAccounts.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id, ct);
        if (account is null)
            return Result.Failure<BankAccountDto>("Bank account not found", "NOT_FOUND");

        var glAccount = await db.Set<ChartOfAccount>().AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == account.GlAccountId, ct);

        return Result.Success(MapBankAccountDto(account, glAccount));
    }

    public async Task<Result<BankAccountDto>> CreateBankAccountAsync(CreateBankAccountCommand command, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(command.AccountName))
            return Result.Failure<BankAccountDto>("Account name is required", "VALIDATION_ERROR");

        if (string.IsNullOrWhiteSpace(command.BankName))
            return Result.Failure<BankAccountDto>("Bank name is required", "VALIDATION_ERROR");

        // Verify GL account exists and is an Asset account (cash accounts are assets)
        var glAccount = await db.Set<ChartOfAccount>().AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == command.GlAccountId, ct);
        if (glAccount is null)
            return Result.Failure<BankAccountDto>("GL account not found", "VALIDATION_ERROR");
        if (glAccount.AccountType != AccountType.Asset)
            return Result.Failure<BankAccountDto>("GL account must be an Asset account (cash/bank)", "VALIDATION_ERROR");

        // Check for duplicate name
        bool nameExists = await db.BankAccounts
            .AnyAsync(a => a.AccountName.ToLower() == command.AccountName.Trim().ToLower(), ct);
        if (nameExists)
            return Result.Failure<BankAccountDto>("A bank account with this name already exists", "DUPLICATE");

        var account = new BankAccount
        {
            AccountName = command.AccountName.Trim(),
            BankName = command.BankName.Trim(),
            AccountNumberLast4 = command.AccountNumberLast4?.Trim() ?? "",
            RoutingNumber = command.RoutingNumber?.Trim(),
            GlAccountId = command.GlAccountId,
            AccountType = command.AccountType,
            OpeningBalance = command.OpeningBalance,
            OpeningBalanceDate = command.OpeningBalanceDate
        };

        db.BankAccounts.Add(account);
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Bank account created: {AccountName} (GL: {GlAccountNumber})", account.AccountName, glAccount.AccountNumber);
        return Result.Success(MapBankAccountDto(account, glAccount));
    }

    public async Task<Result<BankAccountDto>> UpdateBankAccountAsync(UpdateBankAccountCommand command, CancellationToken ct = default)
    {
        var account = await db.BankAccounts.FirstOrDefaultAsync(a => a.Id == command.Id, ct);
        if (account is null)
            return Result.Failure<BankAccountDto>("Bank account not found", "NOT_FOUND");

        if (command.AccountName is not null) account.AccountName = command.AccountName.Trim();
        if (command.BankName is not null) account.BankName = command.BankName.Trim();
        if (command.AccountNumberLast4 is not null) account.AccountNumberLast4 = command.AccountNumberLast4.Trim();
        if (command.RoutingNumber is not null) account.RoutingNumber = command.RoutingNumber.Trim();
        if (command.IsActive.HasValue) account.IsActive = command.IsActive.Value;

        if (command.GlAccountId.HasValue)
        {
            var glAccount = await db.Set<ChartOfAccount>().AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == command.GlAccountId.Value, ct);
            if (glAccount is null)
                return Result.Failure<BankAccountDto>("GL account not found", "VALIDATION_ERROR");
            if (glAccount.AccountType != AccountType.Asset)
                return Result.Failure<BankAccountDto>("GL account must be an Asset account", "VALIDATION_ERROR");
            account.GlAccountId = command.GlAccountId.Value;
        }

        await db.SaveChangesAsync(ct);

        var currentGl = await db.Set<ChartOfAccount>().AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == account.GlAccountId, ct);

        return Result.Success(MapBankAccountDto(account, currentGl));
    }

    public async Task<Result> DeleteBankAccountAsync(Guid id, CancellationToken ct = default)
    {
        var account = await db.BankAccounts.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (account is null)
            return Result.Failure("Bank account not found", "NOT_FOUND");

        // Check for active reconciliations
        bool hasActiveRec = await db.BankReconciliations
            .AnyAsync(r => r.BankAccountId == id && r.Status == BankReconciliationStatus.InProgress, ct);
        if (hasActiveRec)
            return Result.Failure("Cannot delete account with an in-progress reconciliation", "CONFLICT");

        db.BankAccounts.Remove(account); // Soft delete via SaveChangesAsync
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }

    // ─── Bank Transactions ───────────────────────────────────────

    public async Task<Result<ListBankTransactionsResult>> ListBankTransactionsAsync(ListBankTransactionsQuery query, CancellationToken ct = default)
    {
        IQueryable<BankTransaction> q = db.BankTransactions.AsNoTracking()
            .Where(t => t.BankAccountId == query.BankAccountId);

        if (query.IsCleared.HasValue)
            q = q.Where(t => t.IsCleared == query.IsCleared.Value);

        if (query.StartDate.HasValue)
            q = q.Where(t => t.TransactionDate >= query.StartDate.Value);

        if (query.EndDate.HasValue)
            q = q.Where(t => t.TransactionDate <= query.EndDate.Value);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            string term = query.Search.Trim().ToLower();
            q = q.Where(t => t.Description.ToLower().Contains(term) ||
                             (t.CheckNumber != null && t.CheckNumber.Contains(term)) ||
                             (t.ReferenceNumber != null && t.ReferenceNumber.Contains(term)));
        }

        int totalCount = await q.CountAsync(ct);
        int page = Math.Max(1, query.Page);
        int pageSize = Math.Clamp(query.PageSize, 1, 100);

        var items = await q
            .OrderByDescending(t => t.TransactionDate)
            .ThenByDescending(t => t.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        int totalPages = (int)Math.Ceiling((double)totalCount / pageSize);
        return Result.Success(new ListBankTransactionsResult(
            Items: items.Select(MapTransactionDto).ToList(),
            TotalCount: totalCount,
            Page: page,
            PageSize: pageSize,
            TotalPages: totalPages));
    }

    public async Task<Result<ImportBankTransactionsResult>> ImportTransactionsAsync(ImportBankTransactionsCommand command, CancellationToken ct = default)
    {
        var account = await db.BankAccounts.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == command.BankAccountId, ct);
        if (account is null)
            return Result.Failure<ImportBankTransactionsResult>("Bank account not found", "NOT_FOUND");

        if (command.Lines is null || command.Lines.Count == 0)
            return Result.Failure<ImportBankTransactionsResult>("No transactions to import", "VALIDATION_ERROR");

        // Load existing transactions for duplicate detection (by date + amount + description)
        var existingSet = (await db.BankTransactions.AsNoTracking()
            .Where(t => t.BankAccountId == command.BankAccountId)
            .Select(t => new { t.TransactionDate, t.Amount, t.Description })
            .ToListAsync(ct))
            .Select(t => $"{t.TransactionDate}|{t.Amount}|{t.Description}")
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        int imported = 0;
        int skipped = 0;

        foreach (var line in command.Lines)
        {
            string key = $"{line.TransactionDate}|{line.Amount}|{line.Description}";
            if (existingSet.Contains(key))
            {
                skipped++;
                continue;
            }

            db.BankTransactions.Add(new BankTransaction
            {
                BankAccountId = command.BankAccountId,
                TransactionDate = line.TransactionDate,
                Description = line.Description.Trim(),
                Amount = line.Amount,
                CheckNumber = line.CheckNumber?.Trim(),
                ReferenceNumber = line.ReferenceNumber?.Trim(),
                TransactionType = line.TransactionType
            });
            existingSet.Add(key);
            imported++;
        }

        if (imported > 0)
            await db.SaveChangesAsync(ct);

        logger.LogInformation("Imported {Count} bank transactions for account {AccountName} ({Skipped} duplicates skipped)",
            imported, account.AccountName, skipped);

        return Result.Success(new ImportBankTransactionsResult(imported, skipped));
    }

    public async Task<Result> DeleteBankTransactionAsync(Guid id, CancellationToken ct = default)
    {
        var txn = await db.BankTransactions.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (txn is null)
            return Result.Failure("Bank transaction not found", "NOT_FOUND");

        if (txn.IsCleared)
            return Result.Failure("Cannot delete a cleared transaction. Unmatch it first.", "CONFLICT");

        db.BankTransactions.Remove(txn);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }

    // ─── Reconciliation ──────────────────────────────────────────

    public async Task<Result<ListReconciliationsResult>> ListReconciliationsAsync(ListReconciliationsQuery query, CancellationToken ct = default)
    {
        IQueryable<BankRecEntity> q = db.BankReconciliations.AsNoTracking()
            .Include(r => r.BankAccount);

        if (query.BankAccountId.HasValue)
            q = q.Where(r => r.BankAccountId == query.BankAccountId.Value);

        if (query.Status.HasValue)
            q = q.Where(r => r.Status == query.Status.Value);

        int totalCount = await q.CountAsync(ct);
        int page = Math.Max(1, query.Page);
        int pageSize = Math.Clamp(query.PageSize, 1, 100);

        var items = await q
            .OrderByDescending(r => r.StatementDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        int totalPages = (int)Math.Ceiling((double)totalCount / pageSize);
        return Result.Success(new ListReconciliationsResult(
            Items: items.Select(MapReconciliationDto).ToList(),
            TotalCount: totalCount,
            Page: page,
            PageSize: pageSize,
            TotalPages: totalPages));
    }

    public async Task<Result<BankReconciliationDto>> GetReconciliationAsync(Guid id, CancellationToken ct = default)
    {
        var rec = await db.BankReconciliations.AsNoTracking()
            .Include(r => r.BankAccount)
            .FirstOrDefaultAsync(r => r.Id == id, ct);

        if (rec is null)
            return Result.Failure<BankReconciliationDto>("Reconciliation not found", "NOT_FOUND");

        return Result.Success(MapReconciliationDto(rec));
    }

    public async Task<Result<BankReconciliationDto>> StartReconciliationAsync(StartReconciliationCommand command, CancellationToken ct = default)
    {
        var account = await db.BankAccounts.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == command.BankAccountId, ct);
        if (account is null)
            return Result.Failure<BankReconciliationDto>("Bank account not found", "NOT_FOUND");

        // Check for existing in-progress reconciliation
        bool hasActive = await db.BankReconciliations
            .AnyAsync(r => r.BankAccountId == command.BankAccountId && r.Status == BankReconciliationStatus.InProgress, ct);
        if (hasActive)
            return Result.Failure<BankReconciliationDto>("An in-progress reconciliation already exists for this account. Complete or delete it first.", "CONFLICT");

        // Calculate beginning balance from the last completed reconciliation, or use opening balance
        decimal beginningBalance;
        var lastCompleted = await db.BankReconciliations.AsNoTracking()
            .Where(r => r.BankAccountId == command.BankAccountId && r.Status == BankReconciliationStatus.Completed)
            .OrderByDescending(r => r.StatementDate)
            .FirstOrDefaultAsync(ct);

        beginningBalance = lastCompleted?.StatementEndingBalance ?? account.OpeningBalance;

        var reconciliation = new BankRecEntity
        {
            BankAccountId = command.BankAccountId,
            StatementDate = command.StatementDate,
            StatementEndingBalance = command.StatementEndingBalance,
            BeginningBalance = beginningBalance,
            Status = BankReconciliationStatus.InProgress
        };

        RecalculateDifference(reconciliation);

        db.BankReconciliations.Add(reconciliation);
        await db.SaveChangesAsync(ct);

        // Reload with navigation
        reconciliation.BankAccount = account;

        logger.LogInformation("Bank reconciliation started for {AccountName}, statement date {StatementDate}",
            account.AccountName, command.StatementDate);

        return Result.Success(MapReconciliationDto(reconciliation));
    }

    public async Task<Result<BankReconciliationDto>> MatchTransactionAsync(MatchTransactionCommand command, CancellationToken ct = default)
    {
        var rec = await db.BankReconciliations
            .Include(r => r.BankAccount)
            .FirstOrDefaultAsync(r => r.Id == command.ReconciliationId, ct);
        if (rec is null)
            return Result.Failure<BankReconciliationDto>("Reconciliation not found", "NOT_FOUND");

        if (rec.Status != BankReconciliationStatus.InProgress)
            return Result.Failure<BankReconciliationDto>("Reconciliation is already completed", "CONFLICT");

        var txn = await db.BankTransactions.FirstOrDefaultAsync(t => t.Id == command.BankTransactionId, ct);
        if (txn is null)
            return Result.Failure<BankReconciliationDto>("Bank transaction not found", "NOT_FOUND");

        if (txn.BankAccountId != rec.BankAccountId)
            return Result.Failure<BankReconciliationDto>("Transaction does not belong to this bank account", "VALIDATION_ERROR");

        if (txn.IsCleared)
            return Result.Failure<BankReconciliationDto>("Transaction is already cleared", "CONFLICT");

        if (txn.TransactionDate > rec.StatementDate)
            return Result.Failure<BankReconciliationDto>(
                "Cannot match a transaction dated after the statement date", "VALIDATION_ERROR");

        // Mark as cleared
        txn.IsCleared = true;
        txn.BankReconciliationId = rec.Id;
        txn.MatchedJournalEntryId = command.JournalEntryId;
        txn.ClearedAt = DateTime.UtcNow;

        // Update reconciliation totals
        if (txn.Amount >= 0)
            rec.ClearedDeposits += txn.Amount;
        else
            rec.ClearedWithdrawals += Math.Abs(txn.Amount);

        RecalculateDifference(rec);

        await db.SaveChangesAsync(ct);
        return Result.Success(MapReconciliationDto(rec));
    }

    public async Task<Result<BankReconciliationDto>> UnmatchTransactionAsync(UnmatchTransactionCommand command, CancellationToken ct = default)
    {
        var rec = await db.BankReconciliations
            .Include(r => r.BankAccount)
            .FirstOrDefaultAsync(r => r.Id == command.ReconciliationId, ct);
        if (rec is null)
            return Result.Failure<BankReconciliationDto>("Reconciliation not found", "NOT_FOUND");

        if (rec.Status != BankReconciliationStatus.InProgress)
            return Result.Failure<BankReconciliationDto>("Reconciliation is already completed", "CONFLICT");

        var txn = await db.BankTransactions.FirstOrDefaultAsync(t => t.Id == command.BankTransactionId, ct);
        if (txn is null)
            return Result.Failure<BankReconciliationDto>("Bank transaction not found", "NOT_FOUND");

        if (!txn.IsCleared || txn.BankReconciliationId != rec.Id)
            return Result.Failure<BankReconciliationDto>("Transaction is not cleared in this reconciliation", "VALIDATION_ERROR");

        // Reverse the cleared totals
        if (txn.Amount >= 0)
            rec.ClearedDeposits -= txn.Amount;
        else
            rec.ClearedWithdrawals -= Math.Abs(txn.Amount);

        // Unmark
        txn.IsCleared = false;
        txn.BankReconciliationId = null;
        txn.MatchedJournalEntryId = null;
        txn.ClearedAt = null;

        RecalculateDifference(rec);

        await db.SaveChangesAsync(ct);
        return Result.Success(MapReconciliationDto(rec));
    }

    public async Task<Result<BankReconciliationDto>> CompleteReconciliationAsync(CompleteReconciliationCommand command, CancellationToken ct = default)
    {
        var rec = await db.BankReconciliations
            .Include(r => r.BankAccount)
            .FirstOrDefaultAsync(r => r.Id == command.ReconciliationId, ct);
        if (rec is null)
            return Result.Failure<BankReconciliationDto>("Reconciliation not found", "NOT_FOUND");

        if (rec.Status != BankReconciliationStatus.InProgress)
            return Result.Failure<BankReconciliationDto>("Reconciliation is already completed", "CONFLICT");

        if (rec.Difference != 0)
            return Result.Failure<BankReconciliationDto>(
                $"Reconciliation cannot be completed with a difference of {rec.Difference:C2}. All items must be matched.",
                "VALIDATION_ERROR");

        rec.Status = BankReconciliationStatus.Completed;
        rec.CompletedByUserId = command.CompletedByUserId;
        rec.CompletedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        logger.LogInformation("Bank reconciliation completed for {AccountName}, statement date {StatementDate}",
            rec.BankAccount.AccountName, rec.StatementDate);

        return Result.Success(MapReconciliationDto(rec));
    }

    // ─── Helpers ─────────────────────────────────────────────────

    private static void RecalculateDifference(BankRecEntity rec)
    {
        // Difference = Statement ending balance - (Beginning balance + Deposits - Withdrawals)
        decimal bookBalance = rec.BeginningBalance + rec.ClearedDeposits - rec.ClearedWithdrawals;
        rec.Difference = rec.StatementEndingBalance - bookBalance;
    }

    private static BankAccountDto MapBankAccountDto(BankAccount a, Dictionary<Guid, ChartOfAccount> glAccounts)
    {
        glAccounts.TryGetValue(a.GlAccountId, out var gl);
        return new BankAccountDto(
            Id: a.Id,
            AccountName: a.AccountName,
            BankName: a.BankName,
            AccountNumberLast4: a.AccountNumberLast4,
            RoutingNumber: a.RoutingNumber,
            GlAccountId: a.GlAccountId,
            GlAccountNumber: gl?.AccountNumber,
            GlAccountName: gl?.AccountName,
            AccountType: a.AccountType,
            IsActive: a.IsActive,
            OpeningBalance: a.OpeningBalance,
            OpeningBalanceDate: a.OpeningBalanceDate,
            CreatedAt: a.CreatedAt,
            UpdatedAt: a.UpdatedAt
        );
    }

    private static BankAccountDto MapBankAccountDto(BankAccount a, ChartOfAccount? gl)
    {
        return new BankAccountDto(
            Id: a.Id,
            AccountName: a.AccountName,
            BankName: a.BankName,
            AccountNumberLast4: a.AccountNumberLast4,
            RoutingNumber: a.RoutingNumber,
            GlAccountId: a.GlAccountId,
            GlAccountNumber: gl?.AccountNumber,
            GlAccountName: gl?.AccountName,
            AccountType: a.AccountType,
            IsActive: a.IsActive,
            OpeningBalance: a.OpeningBalance,
            OpeningBalanceDate: a.OpeningBalanceDate,
            CreatedAt: a.CreatedAt,
            UpdatedAt: a.UpdatedAt
        );
    }

    private static BankTransactionDto MapTransactionDto(BankTransaction t) => new(
        Id: t.Id,
        BankAccountId: t.BankAccountId,
        TransactionDate: t.TransactionDate,
        Description: t.Description,
        Amount: t.Amount,
        CheckNumber: t.CheckNumber,
        ReferenceNumber: t.ReferenceNumber,
        TransactionType: t.TransactionType,
        IsCleared: t.IsCleared,
        BankReconciliationId: t.BankReconciliationId,
        MatchedJournalEntryId: t.MatchedJournalEntryId,
        ClearedAt: t.ClearedAt,
        CreatedAt: t.CreatedAt
    );

    private static BankReconciliationDto MapReconciliationDto(BankRecEntity r) => new(
        Id: r.Id,
        BankAccountId: r.BankAccountId,
        BankAccountName: r.BankAccount?.AccountName,
        StatementDate: r.StatementDate,
        StatementEndingBalance: r.StatementEndingBalance,
        BeginningBalance: r.BeginningBalance,
        ClearedDeposits: r.ClearedDeposits,
        ClearedWithdrawals: r.ClearedWithdrawals,
        Difference: r.Difference,
        Status: r.Status,
        CompletedByUserId: r.CompletedByUserId,
        CompletedAt: r.CompletedAt,
        CreatedAt: r.CreatedAt,
        UpdatedAt: r.UpdatedAt
    );
}
