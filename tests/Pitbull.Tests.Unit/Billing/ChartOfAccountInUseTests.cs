using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.Features.ChartOfAccounts;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Tests.Unit.Billing;

public class ChartOfAccountInUseTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private static readonly Guid TestCompanyId = Guid.NewGuid();
    private readonly PitbullDbContext _db;
    private readonly ChartOfAccountService _service;

    public ChartOfAccountInUseTests()
    {
        TenantContext tenantContext = new() { TenantId = TestTenantId, TenantName = "Test" };
        CompanyContext companyContext = new() { CompanyId = TestCompanyId };

        DbContextOptions<PitbullDbContext> options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);
        _service = new ChartOfAccountService(_db, NullLogger<ChartOfAccountService>.Instance);
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    private async Task<ChartOfAccount> SeedAccount(string number = "1000", string name = "Cash")
    {
        var account = new ChartOfAccount
        {
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            AccountNumber = number,
            AccountName = name,
            AccountType = AccountType.Asset,
            NormalBalance = NormalBalance.Debit,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };
        _db.Set<ChartOfAccount>().Add(account);
        await _db.SaveChangesAsync();
        return account;
    }

    [Fact]
    public async Task Delete_AccountWithNoEntries_Succeeds()
    {
        var account = await SeedAccount();

        var result = await _service.DeleteChartOfAccountAsync(account.Id);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task Delete_AccountWithJournalEntries_ReturnsInUse()
    {
        var account = await SeedAccount();

        // Create a journal entry line referencing this account
        var entry = new JournalEntry
        {
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            EntryNumber = "JE-2026-000001",
            EntryDate = new DateOnly(2026, 1, 15),
            Description = "Test entry",
            Status = JournalEntryStatus.Posted,
            TotalDebits = 1000m,
            TotalCredits = 1000m,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };
        entry.Lines.Add(new JournalEntryLine
        {
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            LineNumber = 1,
            GlAccountId = account.Id,
            DebitAmount = 1000m,
            CreditAmount = 0m,
            Description = "Debit",
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        });
        _db.Set<JournalEntry>().Add(entry);
        await _db.SaveChangesAsync();

        var result = await _service.DeleteChartOfAccountAsync(account.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("IN_USE");
    }

    [Fact]
    public async Task Delete_AccountWithChildAccounts_ReturnsHasChildren()
    {
        var parent = await SeedAccount("1000", "Parent");
        var child = new ChartOfAccount
        {
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            AccountNumber = "1010",
            AccountName = "Child",
            AccountType = AccountType.Asset,
            NormalBalance = NormalBalance.Debit,
            IsActive = true,
            ParentAccountId = parent.Id,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };
        _db.Set<ChartOfAccount>().Add(child);
        await _db.SaveChangesAsync();

        var result = await _service.DeleteChartOfAccountAsync(parent.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("HAS_CHILDREN");
    }
}
