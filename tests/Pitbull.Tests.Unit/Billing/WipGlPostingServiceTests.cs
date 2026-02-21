using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Billing.Features.Wip;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Tests.Unit.Billing;

public class WipGlPostingServiceTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private static readonly Guid TestCompanyId = Guid.NewGuid();
    private static readonly Guid TestProjectId = Guid.NewGuid();
    private readonly PitbullDbContext _db;
    private readonly WipGlPostingService _service;

    public WipGlPostingServiceTests()
    {
        TenantContext tenantContext = new() { TenantId = TestTenantId, TenantName = "Test" };
        CompanyContext companyContext = new() { CompanyId = TestCompanyId };

        DbContextOptions<PitbullDbContext> options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);
        _service = new WipGlPostingService(_db, NullLogger<WipGlPostingService>.Instance);
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    private ChartOfAccount CreateAccount(string number, string name, AccountType type)
    {
        var account = new ChartOfAccount
        {
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            AccountNumber = number,
            AccountName = name,
            AccountType = type,
            NormalBalance = type == AccountType.Asset || type == AccountType.Expense
                ? NormalBalance.Debit : NormalBalance.Credit,
            IsActive = true,
        };
        _db.Set<ChartOfAccount>().Add(account);
        return account;
    }

    private void SetupStandardWipAccounts()
    {
        CreateAccount("1400", "Costs in Excess of Billings", AccountType.Asset);
        CreateAccount("2400", "Billings in Excess of Costs", AccountType.Liability);
        CreateAccount("4000", "Earned Revenue", AccountType.Revenue);
    }

    private WipReport CreateFinalReport(params (Guid projectId, decimal overUnder)[] lines)
    {
        var report = new WipReport
        {
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            ReportDate = new DateOnly(2026, 2, 28),
            FiscalYear = 2026,
            PeriodNumber = 2,
            Status = WipReportStatus.Final,
            GeneratedById = "test-user",
        };

        foreach (var (projectId, overUnder) in lines)
        {
            report.Lines.Add(new WipReportLine
            {
                TenantId = TestTenantId,
                CompanyId = TestCompanyId,
                WipReportId = report.Id,
                ProjectId = projectId,
                ContractAmount = 1000000m,
                RevisedContractAmount = 1000000m,
                TotalCostToDate = 500000m,
                EstimatedTotalCost = 900000m,
                EstimatedCostToComplete = 400000m,
                PercentComplete = 55.56m,
                EarnedRevenue = 555600m,
                BilledToDate = 555600m - overUnder,
                OverUnderBilling = overUnder,
            });
        }

        _db.Set<WipReport>().Add(report);
        return report;
    }

    // ── Success: accounts exist and types match ──

    [Fact]
    public async Task PostToGl_WithValidAccounts_CreatesJournalEntry()
    {
        SetupStandardWipAccounts();
        var report = CreateFinalReport((TestProjectId, 50000m)); // underbilled
        await _db.SaveChangesAsync();

        var result = await _service.PostToGlAsync(report.Id, "test-user");

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalDebits.Should().Be(50000m);
        result.Value.TotalCredits.Should().Be(50000m);
        result.Value.LineCount.Should().Be(2);
        result.Value.JournalEntryNumber.Should().StartWith("JE-2026-");
    }

    [Fact]
    public async Task PostToGl_Overbilled_CreatesCorrectEntries()
    {
        SetupStandardWipAccounts();
        var report = CreateFinalReport((TestProjectId, -30000m)); // overbilled
        await _db.SaveChangesAsync();

        var result = await _service.PostToGlAsync(report.Id, "test-user");

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalDebits.Should().Be(30000m);
        result.Value.TotalCredits.Should().Be(30000m);
    }

    [Fact]
    public async Task PostToGl_MixedLines_PostsBothDirections()
    {
        SetupStandardWipAccounts();
        var project2 = Guid.NewGuid();
        var report = CreateFinalReport(
            (TestProjectId, 50000m),   // underbilled
            (project2, -20000m));      // overbilled
        await _db.SaveChangesAsync();

        var result = await _service.PostToGlAsync(report.Id, "test-user");

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalDebits.Should().Be(70000m); // 50000 + 20000
        result.Value.TotalCredits.Should().Be(70000m);
        result.Value.LineCount.Should().Be(4); // 2 lines per adjustment
    }

    // ── Missing GL accounts ──

    [Fact]
    public async Task PostToGl_MissingCostInExcessAccount_ReturnsError()
    {
        // Only set up 2 of 3 accounts
        CreateAccount("2400", "Billings in Excess", AccountType.Liability);
        CreateAccount("4000", "Revenue", AccountType.Revenue);
        var report = CreateFinalReport((TestProjectId, 50000m));
        await _db.SaveChangesAsync();

        var result = await _service.PostToGlAsync(report.Id, "test-user");

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("ACCOUNTS_NOT_FOUND");
        result.Error.Should().Contain("1400");
    }

    [Fact]
    public async Task PostToGl_MissingRevenueAccount_ReturnsError()
    {
        CreateAccount("1400", "Costs in Excess", AccountType.Asset);
        CreateAccount("2400", "Billings in Excess", AccountType.Liability);
        var report = CreateFinalReport((TestProjectId, 50000m));
        await _db.SaveChangesAsync();

        var result = await _service.PostToGlAsync(report.Id, "test-user");

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("ACCOUNTS_NOT_FOUND");
        result.Error.Should().Contain("4000");
    }

    [Fact]
    public async Task PostToGl_MissingBillingsInExcessAccount_ReturnsError()
    {
        CreateAccount("1400", "Costs in Excess", AccountType.Asset);
        CreateAccount("4000", "Revenue", AccountType.Revenue);
        var report = CreateFinalReport((TestProjectId, -30000m)); // overbilled needs 2400
        await _db.SaveChangesAsync();

        var result = await _service.PostToGlAsync(report.Id, "test-user");

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("ACCOUNTS_NOT_FOUND");
        result.Error.Should().Contain("2400");
    }

    // ── Account type mismatch ──

    [Fact]
    public async Task PostToGl_CostInExcessNotAsset_ReturnsTypeMismatch()
    {
        CreateAccount("1400", "Costs in Excess", AccountType.Liability); // wrong type!
        CreateAccount("2400", "Billings in Excess", AccountType.Liability);
        CreateAccount("4000", "Revenue", AccountType.Revenue);
        var report = CreateFinalReport((TestProjectId, 50000m));
        await _db.SaveChangesAsync();

        var result = await _service.PostToGlAsync(report.Id, "test-user");

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("ACCOUNT_TYPE_MISMATCH");
        result.Error.Should().Contain("Asset");
    }

    [Fact]
    public async Task PostToGl_RevenueNotRevenueType_ReturnsTypeMismatch()
    {
        CreateAccount("1400", "Costs in Excess", AccountType.Asset);
        CreateAccount("2400", "Billings in Excess", AccountType.Liability);
        CreateAccount("4000", "Revenue", AccountType.Expense); // wrong type!
        var report = CreateFinalReport((TestProjectId, 50000m));
        await _db.SaveChangesAsync();

        var result = await _service.PostToGlAsync(report.Id, "test-user");

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("ACCOUNT_TYPE_MISMATCH");
        result.Error.Should().Contain("Revenue");
    }

    // ── Already posted (idempotency) ──

    [Fact]
    public async Task PostToGl_AlreadyPosted_ReturnsAlreadyPostedError()
    {
        SetupStandardWipAccounts();
        var report = CreateFinalReport((TestProjectId, 50000m));
        report.GlJournalEntryId = Guid.NewGuid(); // already posted
        await _db.SaveChangesAsync();

        var result = await _service.PostToGlAsync(report.Id, "test-user");

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("ALREADY_POSTED");
    }

    // ── Report status validation ──

    [Fact]
    public async Task PostToGl_DraftReport_ReturnsInvalidStatus()
    {
        SetupStandardWipAccounts();
        var report = CreateFinalReport((TestProjectId, 50000m));
        report.Status = WipReportStatus.Draft;
        await _db.SaveChangesAsync();

        var result = await _service.PostToGlAsync(report.Id, "test-user");

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    // ── No adjustments (all flat) ──

    [Fact]
    public async Task PostToGl_AllFlat_ReturnsNoAdjustments()
    {
        SetupStandardWipAccounts();
        var report = CreateFinalReport((TestProjectId, 0m)); // flat
        await _db.SaveChangesAsync();

        var result = await _service.PostToGlAsync(report.Id, "test-user");

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NO_ADJUSTMENTS");
    }

    // ── Marks report as posted ──

    [Fact]
    public async Task PostToGl_Success_MarksReportAsPosted()
    {
        SetupStandardWipAccounts();
        var report = CreateFinalReport((TestProjectId, 50000m));
        await _db.SaveChangesAsync();

        var result = await _service.PostToGlAsync(report.Id, "test-user");

        result.IsSuccess.Should().BeTrue();
        var updated = await _db.Set<WipReport>().FindAsync(report.Id);
        updated!.GlJournalEntryId.Should().NotBeNull();
        updated.PostedToGlAt.Should().NotBeNull();
        updated.PostedToGlBy.Should().Be("test-user");
    }
}
