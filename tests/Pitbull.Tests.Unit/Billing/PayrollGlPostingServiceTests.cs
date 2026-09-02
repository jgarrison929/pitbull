using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Payroll.Domain;
using Pitbull.Payroll.Services;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Entities;

namespace Pitbull.Tests.Unit.Billing;

public class PayrollGlPostingServiceTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private static readonly Guid TestCompanyId = Guid.NewGuid();
    private readonly PitbullDbContext _db;
    private readonly PayrollGlPostingService _service;

    public PayrollGlPostingServiceTests()
    {
        TenantContext tenantContext = new() { TenantId = TestTenantId, TenantName = "Test" };
        CompanyContext companyContext = new() { CompanyId = TestCompanyId };

        DbContextOptions<PitbullDbContext> options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);
        _service = new PayrollGlPostingService(_db, NullLogger<PayrollGlPostingService>.Instance);
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    private void SeedPayrollAccounts()
    {
        _db.Set<ChartOfAccount>().AddRange(
            Account("5000", "Direct Labor", AccountType.Expense),
            Account("5100", "Labor Burden & Benefits", AccountType.Expense),
            Account("2100", "Accrued Payroll", AccountType.Liability),
            Account("2150", "Payroll Taxes Payable", AccountType.Liability));
    }

    private ChartOfAccount Account(string number, string name, AccountType type) => new()
    {
        TenantId = TestTenantId,
        CompanyId = TestCompanyId,
        AccountNumber = number,
        AccountName = name,
        AccountType = type,
        NormalBalance = type == AccountType.Expense ? NormalBalance.Debit : NormalBalance.Credit,
        IsActive = true
    };

    private async Task<PayrollRun> SeedApprovedRunWithSlip(
        Guid projectId,
        Guid costCodeId,
        decimal wages,
        decimal employer,
        decimal withholdings = 0m)
    {
        PayrollRun run = new()
        {
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            RunDate = new DateOnly(2026, 9, 2),
            PayPeriodId = Guid.NewGuid(),
            Status = PayrollRunStatus.Approved,
            TotalGross = wages,
            TotalNet = wages - withholdings,
            EmployeeCount = 1
        };

        PaySlip slip = new()
        {
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            EmployeeId = Guid.NewGuid(),
            Gross = wages,
            Net = wages - withholdings,
            EmployerCost = employer,
            TotalTaxes = withholdings
        };

        slip.Lines.Add(new PaySlipLine
        {
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            ProjectId = projectId,
            CostCodeId = costCodeId,
            ComponentCode = "ST",
            Kind = PayComponentKind.Earning,
            Hours = 8m,
            Rate = wages / 8m,
            Amount = wages
        });

        if (employer > 0m)
        {
            slip.Lines.Add(new PaySlipLine
            {
                TenantId = TestTenantId,
                CompanyId = TestCompanyId,
                ProjectId = projectId,
                CostCodeId = costCodeId,
                ComponentCode = "HW",
                Kind = PayComponentKind.EmployerContribution,
                Hours = 8m,
                Rate = employer / 8m,
                Amount = employer
            });
        }

        if (withholdings > 0m)
        {
            slip.Lines.Add(new PaySlipLine
            {
                TenantId = TestTenantId,
                CompanyId = TestCompanyId,
                ProjectId = projectId,
                CostCodeId = costCodeId,
                ComponentCode = "FIT",
                Kind = PayComponentKind.Deduction,
                Hours = 0m,
                Rate = 0m,
                Amount = withholdings
            });
        }

        run.PaySlips.Add(slip);
        _db.Set<PayrollRun>().Add(run);
        await _db.SaveChangesAsync();
        return run;
    }

    [Fact]
    public async Task PostToGl_ApprovedRun_DebitsLaborAndBurden_CreditsAccruedAndTaxes()
    {
        SeedPayrollAccounts();
        Guid projectId = Guid.NewGuid();
        Guid costCodeId = Guid.NewGuid();
        PayrollRun run = await SeedApprovedRunWithSlip(projectId, costCodeId, wages: 800m, employer: 120m, withholdings: 80m);

        var result = await _service.PostToGlAsync(run.Id, Guid.NewGuid());

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalDebits.Should().Be(920m);
        result.Value.TotalCredits.Should().Be(920m);
        result.Value.AlreadyPosted.Should().BeFalse();

        JournalEntry je = _db.Set<JournalEntry>().Include(x => x.Lines).Single();
        je.SourceModule.Should().Be("Payroll");
        je.SourceDocumentId.Should().Be(run.Id);
        je.Status.Should().Be(JournalEntryStatus.Posted);

        ChartOfAccount labor = _db.Set<ChartOfAccount>().Single(a => a.AccountNumber == "5000");
        ChartOfAccount burden = _db.Set<ChartOfAccount>().Single(a => a.AccountNumber == "5100");
        ChartOfAccount accrued = _db.Set<ChartOfAccount>().Single(a => a.AccountNumber == "2100");
        ChartOfAccount taxes = _db.Set<ChartOfAccount>().Single(a => a.AccountNumber == "2150");

        je.Lines.Should().Contain(l => l.GlAccountId == labor.Id && l.DebitAmount == 800m && l.ProjectId == projectId && l.CostCodeId == costCodeId);
        je.Lines.Should().Contain(l => l.GlAccountId == burden.Id && l.DebitAmount == 120m && l.ProjectId == projectId && l.CostCodeId == costCodeId);
        je.Lines.Should().Contain(l => l.GlAccountId == accrued.Id && l.CreditAmount == 720m && l.ProjectId == projectId && l.CostCodeId == costCodeId);
        je.Lines.Should().Contain(l => l.GlAccountId == taxes.Id && l.CreditAmount == 200m && l.ProjectId == projectId && l.CostCodeId == costCodeId);

        PayrollRun posted = _db.Set<PayrollRun>().Single();
        posted.Status.Should().Be(PayrollRunStatus.Posted);
        posted.GlJournalEntryId.Should().Be(je.Id);
    }

    [Fact]
    public async Task PostToGl_SecondCall_IsIdempotent()
    {
        SeedPayrollAccounts();
        PayrollRun run = await SeedApprovedRunWithSlip(Guid.NewGuid(), Guid.NewGuid(), wages: 400m, employer: 0m);

        var first = await _service.PostToGlAsync(run.Id, null);
        first.IsSuccess.Should().BeTrue();
        Guid journalId = first.Value!.JournalEntryId;

        var second = await _service.PostToGlAsync(run.Id, null);
        second.IsSuccess.Should().BeTrue();
        second.Value!.AlreadyPosted.Should().BeTrue();
        second.Value.JournalEntryId.Should().Be(journalId);
        _db.Set<JournalEntry>().Should().HaveCount(1);
    }

    [Fact]
    public async Task PostToGl_DraftRun_ReturnsInvalidStatus()
    {
        SeedPayrollAccounts();
        PayrollRun run = new()
        {
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            RunDate = new DateOnly(2026, 9, 2),
            PayPeriodId = Guid.NewGuid(),
            Status = PayrollRunStatus.Draft
        };
        _db.Set<PayrollRun>().Add(run);
        await _db.SaveChangesAsync();

        var result = await _service.PostToGlAsync(run.Id, null);
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task PostToGl_DoesNotUseThirtyFivePercentBurden()
    {
        SeedPayrollAccounts();
        PayrollRun run = await SeedApprovedRunWithSlip(Guid.NewGuid(), Guid.NewGuid(), wages: 1000m, employer: 40m);

        var result = await _service.PostToGlAsync(run.Id, null);
        result.IsSuccess.Should().BeTrue();

        ChartOfAccount burden = _db.Set<ChartOfAccount>().Single(a => a.AccountNumber == "5100");
        JournalEntry je = _db.Set<JournalEntry>().Include(x => x.Lines).Single();
        je.Lines.Single(l => l.GlAccountId == burden.Id).DebitAmount.Should().Be(40m);
        je.Lines.Should().NotContain(l => l.DebitAmount == 350m);
    }
}
