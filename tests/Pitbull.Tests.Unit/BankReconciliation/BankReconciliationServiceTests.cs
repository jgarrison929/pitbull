using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Billing.Features.BankReconciliation;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Tests.Unit.BankReconciliation;

public class BankReconciliationServiceTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private static readonly Guid TestCompanyId = Guid.NewGuid();
    private readonly PitbullDbContext _db;
    private readonly BankReconciliationService _service;

    public BankReconciliationServiceTests()
    {
        TenantContext tenantContext = new() { TenantId = TestTenantId, TenantName = "Test" };
        CompanyContext companyContext = new() { CompanyId = TestCompanyId };

        DbContextOptions<PitbullDbContext> options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);
        _service = new BankReconciliationService(_db, NullLogger<BankReconciliationService>.Instance);
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    // ─── Helpers ───────────────────────────────────────────────────

    private async Task<ChartOfAccount> SeedAssetGlAccountAsync(string accountNumber = "1000", string accountName = "Cash - Operating")
    {
        var gl = new ChartOfAccount
        {
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            AccountNumber = accountNumber,
            AccountName = accountName,
            AccountType = AccountType.Asset,
            NormalBalance = NormalBalance.Debit,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };
        _db.Set<ChartOfAccount>().Add(gl);
        await _db.SaveChangesAsync();
        return gl;
    }

    private async Task<ChartOfAccount> SeedExpenseGlAccountAsync()
    {
        var gl = new ChartOfAccount
        {
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            AccountNumber = "5000",
            AccountName = "Office Supplies",
            AccountType = AccountType.Expense,
            NormalBalance = NormalBalance.Debit,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };
        _db.Set<ChartOfAccount>().Add(gl);
        await _db.SaveChangesAsync();
        return gl;
    }

    private CreateBankAccountCommand ValidCreateCommand(Guid glAccountId, string name = "Operating Account") =>
        new(
            AccountName: name,
            BankName: "First National Bank",
            AccountNumberLast4: "4321",
            RoutingNumber: "123456789",
            GlAccountId: glAccountId,
            AccountType: BankAccountType.Checking,
            OpeningBalance: 10000m,
            OpeningBalanceDate: new DateOnly(2026, 1, 1)
        );

    private async Task<BankAccountDto> CreateBankAccountAsync(Guid? glAccountId = null, string name = "Operating Account", decimal openingBalance = 10000m)
    {
        var gl = glAccountId.HasValue
            ? (await _db.Set<ChartOfAccount>().FindAsync(glAccountId.Value))!
            : await SeedAssetGlAccountAsync();

        var command = new CreateBankAccountCommand(
            AccountName: name,
            BankName: "First National Bank",
            AccountNumberLast4: "4321",
            RoutingNumber: "123456789",
            GlAccountId: gl.Id,
            AccountType: BankAccountType.Checking,
            OpeningBalance: openingBalance,
            OpeningBalanceDate: new DateOnly(2026, 1, 1)
        );

        var result = await _service.CreateBankAccountAsync(command);
        result.IsSuccess.Should().BeTrue();
        return result.Value!;
    }

    private async Task<BankTransaction> SeedBankTransactionAsync(
        Guid bankAccountId,
        decimal amount,
        string description = "Test transaction",
        bool isCleared = false,
        Guid? reconciliationId = null)
    {
        // Clear tracked entities to avoid conflicts when the BankAccount
        // is already tracked from prior service calls.
        _db.ChangeTracker.Clear();

        var txn = new BankTransaction
        {
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            BankAccountId = bankAccountId,
            TransactionDate = new DateOnly(2026, 1, 15),
            Description = description,
            Amount = amount,
            TransactionType = amount >= 0 ? BankTransactionType.Deposit : BankTransactionType.Check,
            IsCleared = isCleared,
            BankReconciliationId = reconciliationId,
            ClearedAt = isCleared ? DateTime.UtcNow : null,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };
        _db.BankTransactions.Add(txn);
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();
        return txn;
    }

    // ─── Bank Account Tests ───────────────────────────────────────

    #region Bank Accounts

    [Fact]
    public async Task CreateBankAccount_ValidInput_Succeeds()
    {
        // Arrange
        var gl = await SeedAssetGlAccountAsync();
        var command = ValidCreateCommand(gl.Id);

        // Act
        var result = await _service.CreateBankAccountAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.AccountName.Should().Be("Operating Account");
        result.Value.BankName.Should().Be("First National Bank");
        result.Value.AccountNumberLast4.Should().Be("4321");
        result.Value.AccountType.Should().Be(BankAccountType.Checking);
        result.Value.OpeningBalance.Should().Be(10000m);
        result.Value.GlAccountId.Should().Be(gl.Id);
        result.Value.GlAccountNumber.Should().Be("1000");
        result.Value.GlAccountName.Should().Be("Cash - Operating");
        result.Value.IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task CreateBankAccount_DuplicateName_Fails()
    {
        // Arrange
        var gl = await SeedAssetGlAccountAsync();
        await _service.CreateBankAccountAsync(ValidCreateCommand(gl.Id, "Operating Account"));

        // Act — try to create with the same name
        var result = await _service.CreateBankAccountAsync(ValidCreateCommand(gl.Id, "Operating Account"));

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("DUPLICATE");
        result.Error.Should().Contain("already exists");
    }

    [Fact]
    public async Task CreateBankAccount_NonAssetGlAccount_Fails()
    {
        // Arrange
        var expenseGl = await SeedExpenseGlAccountAsync();
        var command = ValidCreateCommand(expenseGl.Id);

        // Act
        var result = await _service.CreateBankAccountAsync(command);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("Asset");
    }

    [Fact]
    public async Task CreateBankAccount_MissingName_Fails()
    {
        // Arrange
        var gl = await SeedAssetGlAccountAsync();
        var command = new CreateBankAccountCommand(
            AccountName: "",
            BankName: "First National Bank",
            AccountNumberLast4: "4321",
            RoutingNumber: null,
            GlAccountId: gl.Id,
            AccountType: BankAccountType.Checking,
            OpeningBalance: 0m,
            OpeningBalanceDate: null
        );

        // Act
        var result = await _service.CreateBankAccountAsync(command);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("Account name");
    }

    [Fact]
    public async Task UpdateBankAccount_ChangeName_Succeeds()
    {
        // Arrange
        var account = await CreateBankAccountAsync();
        var command = new UpdateBankAccountCommand(
            Id: account.Id,
            AccountName: "Payroll Account",
            BankName: null,
            AccountNumberLast4: null,
            RoutingNumber: null,
            GlAccountId: null,
            IsActive: null
        );

        // Act
        var result = await _service.UpdateBankAccountAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.AccountName.Should().Be("Payroll Account");
        result.Value.BankName.Should().Be("First National Bank"); // unchanged
    }

    [Fact]
    public async Task DeleteBankAccount_NoActiveReconciliation_Succeeds()
    {
        // Arrange
        var account = await CreateBankAccountAsync();

        // Act
        var result = await _service.DeleteBankAccountAsync(account.Id);

        // Assert
        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteBankAccount_WithActiveReconciliation_Fails()
    {
        // Arrange
        var account = await CreateBankAccountAsync();

        // Seed an in-progress reconciliation
        _db.BankReconciliations.Add(new Core.Domain.BankReconciliation
        {
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            BankAccountId = account.Id,
            StatementDate = new DateOnly(2026, 1, 31),
            StatementEndingBalance = 10000m,
            BeginningBalance = 10000m,
            Status = BankReconciliationStatus.InProgress,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        });
        await _db.SaveChangesAsync();

        // Act
        var result = await _service.DeleteBankAccountAsync(account.Id);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("CONFLICT");
        result.Error.Should().Contain("in-progress reconciliation");
    }

    [Fact]
    public async Task ListBankAccounts_FilterByActive_ReturnsCorrectResults()
    {
        // Arrange
        var gl = await SeedAssetGlAccountAsync();
        await _service.CreateBankAccountAsync(ValidCreateCommand(gl.Id, "Active Account"));

        var gl2 = await SeedAssetGlAccountAsync("1001", "Cash - Payroll");
        var inactiveResult = await _service.CreateBankAccountAsync(ValidCreateCommand(gl2.Id, "Inactive Account"));
        inactiveResult.IsSuccess.Should().BeTrue();

        // Deactivate the second account
        await _service.UpdateBankAccountAsync(new UpdateBankAccountCommand(
            Id: inactiveResult.Value!.Id,
            AccountName: null, BankName: null, AccountNumberLast4: null,
            RoutingNumber: null, GlAccountId: null, IsActive: false));

        // Act — filter by active
        var activeResult = await _service.ListBankAccountsAsync(new ListBankAccountsQuery(IsActive: true));
        var inactiveListResult = await _service.ListBankAccountsAsync(new ListBankAccountsQuery(IsActive: false));

        // Assert
        activeResult.IsSuccess.Should().BeTrue();
        activeResult.Value!.Items.Should().OnlyContain(a => a.IsActive);
        activeResult.Value.TotalCount.Should().Be(1);

        inactiveListResult.IsSuccess.Should().BeTrue();
        inactiveListResult.Value!.Items.Should().OnlyContain(a => !a.IsActive);
        inactiveListResult.Value.TotalCount.Should().Be(1);
    }

    #endregion

    // ─── Bank Transaction Tests ───────────────────────────────────

    #region Bank Transactions

    [Fact]
    public async Task ImportTransactions_ValidLines_Succeeds()
    {
        // Arrange
        var account = await CreateBankAccountAsync();
        var command = new ImportBankTransactionsCommand(
            BankAccountId: account.Id,
            Lines:
            [
                new ImportBankTransactionLine(
                    TransactionDate: new DateOnly(2026, 1, 10),
                    Description: "Deposit from client",
                    Amount: 5000m,
                    CheckNumber: null,
                    ReferenceNumber: "DEP-001",
                    TransactionType: BankTransactionType.Deposit),
                new ImportBankTransactionLine(
                    TransactionDate: new DateOnly(2026, 1, 12),
                    Description: "Office supplies",
                    Amount: -250m,
                    CheckNumber: "1001",
                    ReferenceNumber: null,
                    TransactionType: BankTransactionType.Check)
            ]);

        // Act
        var result = await _service.ImportTransactionsAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.ImportedCount.Should().Be(2);
        result.Value.SkippedDuplicates.Should().Be(0);

        // Verify they exist in DB
        var txns = await _db.BankTransactions.Where(t => t.BankAccountId == account.Id).ToListAsync();
        txns.Should().HaveCount(2);
    }

    [Fact]
    public async Task ImportTransactions_DuplicateLines_SkipsAndReports()
    {
        // Arrange
        var account = await CreateBankAccountAsync();

        // Import first batch
        var firstBatch = new ImportBankTransactionsCommand(
            BankAccountId: account.Id,
            Lines:
            [
                new ImportBankTransactionLine(
                    TransactionDate: new DateOnly(2026, 1, 10),
                    Description: "Client payment",
                    Amount: 5000m,
                    CheckNumber: null,
                    ReferenceNumber: null,
                    TransactionType: BankTransactionType.Deposit)
            ]);
        await _service.ImportTransactionsAsync(firstBatch);

        // Import second batch with the same line plus a new one
        var secondBatch = new ImportBankTransactionsCommand(
            BankAccountId: account.Id,
            Lines:
            [
                new ImportBankTransactionLine(
                    TransactionDate: new DateOnly(2026, 1, 10),
                    Description: "Client payment",
                    Amount: 5000m,
                    CheckNumber: null,
                    ReferenceNumber: null,
                    TransactionType: BankTransactionType.Deposit),
                new ImportBankTransactionLine(
                    TransactionDate: new DateOnly(2026, 1, 15),
                    Description: "New payment",
                    Amount: 3000m,
                    CheckNumber: null,
                    ReferenceNumber: null,
                    TransactionType: BankTransactionType.Deposit)
            ]);

        // Act
        var result = await _service.ImportTransactionsAsync(secondBatch);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.ImportedCount.Should().Be(1);
        result.Value.SkippedDuplicates.Should().Be(1);
    }

    [Fact]
    public async Task ImportTransactions_EmptyLines_Fails()
    {
        // Arrange
        var account = await CreateBankAccountAsync();
        var command = new ImportBankTransactionsCommand(
            BankAccountId: account.Id,
            Lines: []);

        // Act
        var result = await _service.ImportTransactionsAsync(command);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("No transactions");
    }

    [Fact]
    public async Task DeleteTransaction_Uncleared_Succeeds()
    {
        // Arrange
        var account = await CreateBankAccountAsync();
        var txn = await SeedBankTransactionAsync(account.Id, 1000m);

        // Act
        var result = await _service.DeleteBankTransactionAsync(txn.Id);

        // Assert
        result.IsSuccess.Should().BeTrue();

        var exists = await _db.BankTransactions.AnyAsync(t => t.Id == txn.Id);
        exists.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteTransaction_Cleared_Fails()
    {
        // Arrange
        var account = await CreateBankAccountAsync();
        var txn = await SeedBankTransactionAsync(account.Id, 1000m, isCleared: true);

        // Act
        var result = await _service.DeleteBankTransactionAsync(txn.Id);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("CONFLICT");
        result.Error.Should().Contain("cleared");
    }

    #endregion

    // ─── Reconciliation Tests ─────────────────────────────────────

    #region Reconciliation

    [Fact]
    public async Task StartReconciliation_ValidInput_Succeeds()
    {
        // Arrange
        var account = await CreateBankAccountAsync(openingBalance: 10000m);
        var command = new StartReconciliationCommand(
            BankAccountId: account.Id,
            StatementDate: new DateOnly(2026, 1, 31),
            StatementEndingBalance: 12000m
        );

        // Act
        var result = await _service.StartReconciliationAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.BankAccountId.Should().Be(account.Id);
        result.Value.StatementDate.Should().Be(new DateOnly(2026, 1, 31));
        result.Value.StatementEndingBalance.Should().Be(12000m);
        result.Value.BeginningBalance.Should().Be(10000m); // from opening balance
        result.Value.Status.Should().Be(BankReconciliationStatus.InProgress);
        result.Value.ClearedDeposits.Should().Be(0m);
        result.Value.ClearedWithdrawals.Should().Be(0m);
        // Difference = 12000 - (10000 + 0 - 0) = 2000
        result.Value.Difference.Should().Be(2000m);
    }

    [Fact]
    public async Task StartReconciliation_ExistingInProgress_Fails()
    {
        // Arrange
        var account = await CreateBankAccountAsync();
        var command = new StartReconciliationCommand(
            BankAccountId: account.Id,
            StatementDate: new DateOnly(2026, 1, 31),
            StatementEndingBalance: 12000m
        );

        // Start the first reconciliation
        var first = await _service.StartReconciliationAsync(command);
        first.IsSuccess.Should().BeTrue();

        // Act — try to start a second one
        var secondCommand = new StartReconciliationCommand(
            BankAccountId: account.Id,
            StatementDate: new DateOnly(2026, 2, 28),
            StatementEndingBalance: 15000m
        );
        var result = await _service.StartReconciliationAsync(secondCommand);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("CONFLICT");
        result.Error.Should().Contain("in-progress");
    }

    [Fact]
    public async Task StartReconciliation_CalculatesBeginningBalance_FromLastCompleted()
    {
        // Arrange
        var account = await CreateBankAccountAsync(openingBalance: 10000m);

        // Seed a completed reconciliation with a known ending balance
        _db.BankReconciliations.Add(new Core.Domain.BankReconciliation
        {
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            BankAccountId = account.Id,
            StatementDate = new DateOnly(2026, 1, 31),
            StatementEndingBalance = 15000m,
            BeginningBalance = 10000m,
            ClearedDeposits = 7000m,
            ClearedWithdrawals = 2000m,
            Difference = 0m,
            Status = BankReconciliationStatus.Completed,
            CompletedByUserId = Guid.NewGuid(),
            CompletedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        });
        await _db.SaveChangesAsync();

        // Act — start a new reconciliation; beginning balance should come from the last completed
        var command = new StartReconciliationCommand(
            BankAccountId: account.Id,
            StatementDate: new DateOnly(2026, 2, 28),
            StatementEndingBalance: 20000m
        );
        var result = await _service.StartReconciliationAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.BeginningBalance.Should().Be(15000m); // from last completed's StatementEndingBalance
    }

    [Fact]
    public async Task MatchTransaction_ValidTransaction_ClearsAndUpdatesBalance()
    {
        // Arrange
        var account = await CreateBankAccountAsync(openingBalance: 10000m);
        var rec = await StartReconciliation(account.Id, statementEndingBalance: 15000m);
        var depositTxn = await SeedBankTransactionAsync(account.Id, 5000m, "Client deposit");

        var command = new MatchTransactionCommand(
            ReconciliationId: rec.Id,
            BankTransactionId: depositTxn.Id
        );

        // Act
        var result = await _service.MatchTransactionAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.ClearedDeposits.Should().Be(5000m);
        result.Value.ClearedWithdrawals.Should().Be(0m);
        // Difference = 15000 - (10000 + 5000 - 0) = 0
        result.Value.Difference.Should().Be(0m);

        // Verify transaction is marked as cleared
        var txn = await _db.BankTransactions.FindAsync(depositTxn.Id);
        txn!.IsCleared.Should().BeTrue();
        txn.BankReconciliationId.Should().Be(rec.Id);
        txn.ClearedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task MatchTransaction_AlreadyCleared_Fails()
    {
        // Arrange
        var account = await CreateBankAccountAsync(openingBalance: 10000m);
        var rec = await StartReconciliation(account.Id, statementEndingBalance: 15000m);
        var txn = await SeedBankTransactionAsync(account.Id, 5000m, isCleared: true, reconciliationId: rec.Id);

        var command = new MatchTransactionCommand(
            ReconciliationId: rec.Id,
            BankTransactionId: txn.Id
        );

        // Act
        var result = await _service.MatchTransactionAsync(command);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("CONFLICT");
        result.Error.Should().Contain("already cleared");
    }

    [Fact]
    public async Task MatchTransaction_WrongBankAccount_Fails()
    {
        // Arrange
        var account1 = await CreateBankAccountAsync(name: "Account One");
        var gl2 = await SeedAssetGlAccountAsync("1002", "Cash - Account Two");
        var account2 = await CreateBankAccountAsync(glAccountId: gl2.Id, name: "Account Two");

        var rec = await StartReconciliation(account1.Id, statementEndingBalance: 12000m);
        var txn = await SeedBankTransactionAsync(account2.Id, 5000m, "Wrong account deposit");

        var command = new MatchTransactionCommand(
            ReconciliationId: rec.Id,
            BankTransactionId: txn.Id
        );

        // Act
        var result = await _service.MatchTransactionAsync(command);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("does not belong");
    }

    [Fact]
    public async Task UnmatchTransaction_ClearedTransaction_Succeeds()
    {
        // Arrange
        var account = await CreateBankAccountAsync(openingBalance: 10000m);
        var rec = await StartReconciliation(account.Id, statementEndingBalance: 15000m);
        var txn = await SeedBankTransactionAsync(account.Id, 5000m, "Deposit to unmatch");

        // Match first
        await _service.MatchTransactionAsync(new MatchTransactionCommand(rec.Id, txn.Id));

        // Act — unmatch
        var result = await _service.UnmatchTransactionAsync(new UnmatchTransactionCommand(rec.Id, txn.Id));

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.ClearedDeposits.Should().Be(0m);
        // Difference should revert: 15000 - (10000 + 0 - 0) = 5000
        result.Value.Difference.Should().Be(5000m);

        // Verify transaction is uncleared
        var updated = await _db.BankTransactions.FindAsync(txn.Id);
        updated!.IsCleared.Should().BeFalse();
        updated.BankReconciliationId.Should().BeNull();
        updated.ClearedAt.Should().BeNull();
    }

    [Fact]
    public async Task UnmatchTransaction_NotCleared_Fails()
    {
        // Arrange
        var account = await CreateBankAccountAsync(openingBalance: 10000m);
        var rec = await StartReconciliation(account.Id, statementEndingBalance: 15000m);
        var txn = await SeedBankTransactionAsync(account.Id, 5000m); // not cleared

        // Act
        var result = await _service.UnmatchTransactionAsync(new UnmatchTransactionCommand(rec.Id, txn.Id));

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("not cleared");
    }

    [Fact]
    public async Task CompleteReconciliation_ZeroDifference_Succeeds()
    {
        // Arrange
        var account = await CreateBankAccountAsync(openingBalance: 10000m);
        var rec = await StartReconciliation(account.Id, statementEndingBalance: 15000m);

        // Seed and match a deposit that brings the difference to zero
        var txn = await SeedBankTransactionAsync(account.Id, 5000m, "Balancing deposit");
        await _service.MatchTransactionAsync(new MatchTransactionCommand(rec.Id, txn.Id));

        // Verify difference is zero before completing
        var recState = await _service.GetReconciliationAsync(rec.Id);
        recState.Value!.Difference.Should().Be(0m);

        // Act
        var userId = Guid.NewGuid();
        var result = await _service.CompleteReconciliationAsync(
            new CompleteReconciliationCommand(rec.Id, userId));

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(BankReconciliationStatus.Completed);
        result.Value.CompletedByUserId.Should().Be(userId);
        result.Value.CompletedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task CompleteReconciliation_NonZeroDifference_Fails()
    {
        // Arrange
        var account = await CreateBankAccountAsync(openingBalance: 10000m);
        var rec = await StartReconciliation(account.Id, statementEndingBalance: 15000m);
        // Don't match any transactions — difference remains 5000

        // Act
        var result = await _service.CompleteReconciliationAsync(
            new CompleteReconciliationCommand(rec.Id, Guid.NewGuid()));

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("difference");
    }

    [Fact]
    public async Task CompleteReconciliation_AlreadyCompleted_Fails()
    {
        // Arrange
        var account = await CreateBankAccountAsync(openingBalance: 10000m);
        var rec = await StartReconciliation(account.Id, statementEndingBalance: 15000m);

        // Match transactions to get difference to zero
        var txn = await SeedBankTransactionAsync(account.Id, 5000m, "Balancing deposit");
        await _service.MatchTransactionAsync(new MatchTransactionCommand(rec.Id, txn.Id));

        // Complete the reconciliation
        await _service.CompleteReconciliationAsync(
            new CompleteReconciliationCommand(rec.Id, Guid.NewGuid()));

        // Act — try to complete again
        var result = await _service.CompleteReconciliationAsync(
            new CompleteReconciliationCommand(rec.Id, Guid.NewGuid()));

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("CONFLICT");
        result.Error.Should().Contain("already completed");
    }

    #endregion

    // ─── Reconciliation Helpers ───────────────────────────────────

    private async Task<BankReconciliationDto> StartReconciliation(
        Guid bankAccountId,
        decimal statementEndingBalance = 12000m,
        DateOnly? statementDate = null)
    {
        var command = new StartReconciliationCommand(
            BankAccountId: bankAccountId,
            StatementDate: statementDate ?? new DateOnly(2026, 1, 31),
            StatementEndingBalance: statementEndingBalance
        );

        var result = await _service.StartReconciliationAsync(command);
        result.IsSuccess.Should().BeTrue();
        return result.Value!;
    }
}
