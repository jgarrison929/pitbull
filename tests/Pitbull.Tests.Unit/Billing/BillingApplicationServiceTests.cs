using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Billing.Features.AiaBilling;
using Pitbull.Billing.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Tests.Unit.Billing;

public class BillingApplicationServiceTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private static readonly Guid TestCompanyId = Guid.NewGuid();
    private static readonly Guid TestProjectId = Guid.NewGuid();
    private readonly PitbullDbContext _db;
    private readonly BillingApplicationService _service;

    public BillingApplicationServiceTests()
    {
        TenantContext tenantContext = new() { TenantId = TestTenantId, TenantName = "Test" };
        CompanyContext companyContext = new() { CompanyId = TestCompanyId };

        DbContextOptions<PitbullDbContext> options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);
        _service = new BillingApplicationService(_db, NullLogger<BillingApplicationService>.Instance);
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    private OwnerContract CreateContract(decimal originalSum = 1000000m, decimal retainagePercent = 10m)
    {
        var contract = new OwnerContract
        {
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            ProjectId = TestProjectId,
            ContractNumber = "OC-001",
            ProjectName = "Test Project",
            OriginalContractSum = originalSum,
            ContractSumToDate = originalSum,
            DefaultRetainagePercent = retainagePercent,
            RetainagePercentMaterials = retainagePercent,
            Status = OwnerContractStatus.Active,
        };
        _db.Set<OwnerContract>().Add(contract);
        return contract;
    }

    private OwnerScheduleOfValues CreateSOV(Guid contractId, params (string itemNum, string desc, decimal value)[] lines)
    {
        var sov = new OwnerScheduleOfValues
        {
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            ProjectId = TestProjectId,
            OwnerContractId = contractId,
            Name = "Main SOV",
            Status = OwnerSOVStatus.Active,
            OriginalContractAmount = lines.Sum(l => l.value),
            TotalScheduledValue = lines.Sum(l => l.value),
            RevisedContractAmount = lines.Sum(l => l.value),
        };
        _db.Set<OwnerScheduleOfValues>().Add(sov);

        int sort = 1;
        foreach (var (itemNum, desc, value) in lines)
        {
            var lineItem = new OwnerSOVLineItem
            {
                TenantId = TestTenantId,
                CompanyId = TestCompanyId,
                OwnerScheduleOfValuesId = sov.Id,
                ItemNumber = itemNum,
                Description = desc,
                ScheduledValue = value,
                OriginalValue = value,
                SortOrder = sort++,
            };
            _db.Set<OwnerSOVLineItem>().Add(lineItem);
        }

        return sov;
    }

    private CreateBillingApplicationCommand CreateCmd(Guid contractId, Guid sovId, int month = 1) => new(
        OwnerContractId: contractId,
        OwnerScheduleOfValuesId: sovId,
        PeriodFrom: new DateOnly(2026, month, 1),
        PeriodThrough: new DateOnly(2026, month, DateTime.DaysInMonth(2026, month)),
        ApplicationDate: new DateOnly(2026, month, 25)
    );

    // ── First application (no prior) ──

    [Fact]
    public async Task Create_FirstApplication_WorkCompletedPreviousIsZero()
    {
        var contract = CreateContract();
        var sov = CreateSOV(contract.Id, ("1", "Concrete", 500000m), ("2", "Steel", 300000m));
        await _db.SaveChangesAsync();

        var result = await _service.CreateAsync(CreateCmd(contract.Id, sov.Id));

        result.IsSuccess.Should().BeTrue();
        var dto = result.Value!;
        dto.ApplicationNumber.Should().Be(1);
        dto.LineItems.Should().NotBeNull();
        dto.LineItems!.Should().HaveCount(2);
        dto.LineItems.Should().AllSatisfy(l => l.WorkCompletedPrevious.Should().Be(0m));
    }

    // ── Multi-period billing: correct carry-forward ──

    [Fact]
    public async Task Create_SecondApplication_CarriesForwardWorkNotMaterials()
    {
        var contract = CreateContract();
        var sov = CreateSOV(contract.Id, ("1", "Concrete", 500000m));
        await _db.SaveChangesAsync();

        // Create first application
        var app1Result = await _service.CreateAsync(CreateCmd(contract.Id, sov.Id, 1));
        app1Result.IsSuccess.Should().BeTrue();
        var app1Line = app1Result.Value!.LineItems![0];

        // Update line: 100k work this period, 20k materials stored
        await _service.UpdateLineAsync(new UpdateBillingApplicationLineCommand(
            app1Result.Value.Id, app1Line.Id, 100000m, 20000m));

        // Create second application
        var app2Result = await _service.CreateAsync(CreateCmd(contract.Id, sov.Id, 2));

        app2Result.IsSuccess.Should().BeTrue();
        var app2Line = app2Result.Value!.LineItems![0];
        // WorkCompletedPrevious = prior D + E = 0 + 100000 = 100000 (not including materials)
        app2Line.WorkCompletedPrevious.Should().Be(100000m);
        // Materials carry forward separately
        app2Line.MaterialsStoredToDate.Should().Be(20000m);
    }

    // ── Three consecutive applications ──

    [Fact]
    public async Task Create_ThirdApplication_AccumulatesWorkCorrectly()
    {
        var contract = CreateContract();
        var sov = CreateSOV(contract.Id, ("1", "Concrete", 500000m));
        await _db.SaveChangesAsync();

        // App 1: 100k work, no materials
        var app1 = await _service.CreateAsync(CreateCmd(contract.Id, sov.Id, 1));
        await _service.UpdateLineAsync(new UpdateBillingApplicationLineCommand(
            app1.Value!.Id, app1.Value.LineItems![0].Id, 100000m, 0m));

        // App 2: 80k additional work, 10k materials
        var app2 = await _service.CreateAsync(CreateCmd(contract.Id, sov.Id, 2));
        await _service.UpdateLineAsync(new UpdateBillingApplicationLineCommand(
            app2.Value!.Id, app2.Value.LineItems![0].Id, 80000m, 10000m));

        // App 3: should carry forward 100000 + 80000 = 180000 work
        var app3 = await _service.CreateAsync(CreateCmd(contract.Id, sov.Id, 3));

        app3.IsSuccess.Should().BeTrue();
        var app3Line = app3.Value!.LineItems![0];
        // D = prior D(100000) + prior E(80000) = 180000
        app3Line.WorkCompletedPrevious.Should().Be(180000m);
        app3Line.MaterialsStoredToDate.Should().Be(10000m);
    }

    // ── Billing after a voided application ──

    [Fact]
    public async Task Create_AfterVoidedApplication_SkipsVoidedForCarryForward()
    {
        var contract = CreateContract();
        var sov = CreateSOV(contract.Id, ("1", "Concrete", 500000m));
        await _db.SaveChangesAsync();

        // App 1: 100k work
        var app1 = await _service.CreateAsync(CreateCmd(contract.Id, sov.Id, 1));
        await _service.UpdateLineAsync(new UpdateBillingApplicationLineCommand(
            app1.Value!.Id, app1.Value.LineItems![0].Id, 100000m, 0m));

        // App 2: 50k work (will be voided)
        var app2 = await _service.CreateAsync(CreateCmd(contract.Id, sov.Id, 2));
        await _service.UpdateLineAsync(new UpdateBillingApplicationLineCommand(
            app2.Value!.Id, app2.Value.LineItems![0].Id, 50000m, 0m));

        // Void app 2
        await _service.VoidAsync(app2.Value.Id);

        // App 3: should carry forward from app 1 (skipping voided app 2)
        var app3 = await _service.CreateAsync(CreateCmd(contract.Id, sov.Id, 3));

        app3.IsSuccess.Should().BeTrue();
        var app3Line = app3.Value!.LineItems![0];
        // Should use app 1's values (D=0 + E=100000 = 100000), not app 2's
        app3Line.WorkCompletedPrevious.Should().Be(100000m);
    }

    // ── Line with 100% completion in prior period ──

    [Fact]
    public async Task Create_LineFullyCompletedInPrior_CarriesForwardFullAmount()
    {
        var contract = CreateContract();
        var sov = CreateSOV(contract.Id, ("1", "Concrete", 200000m));
        await _db.SaveChangesAsync();

        // App 1: complete 100% of line
        var app1 = await _service.CreateAsync(CreateCmd(contract.Id, sov.Id, 1));
        await _service.UpdateLineAsync(new UpdateBillingApplicationLineCommand(
            app1.Value!.Id, app1.Value.LineItems![0].Id, 200000m, 0m));

        // App 2: carry forward should show full 200k as previous
        var app2 = await _service.CreateAsync(CreateCmd(contract.Id, sov.Id, 2));

        app2.IsSuccess.Should().BeTrue();
        var app2Line = app2.Value!.LineItems![0];
        app2Line.WorkCompletedPrevious.Should().Be(200000m);
        app2Line.WorkCompletedThisPeriod.Should().Be(0m);
    }

    // ── LessPreviousCertificates skips voided prior ──

    [Fact]
    public async Task Create_LessPreviousCertificates_SkipsVoidedPrior()
    {
        var contract = CreateContract();
        var sov = CreateSOV(contract.Id, ("1", "Concrete", 500000m));
        await _db.SaveChangesAsync();

        // App 1: some work
        var app1 = await _service.CreateAsync(CreateCmd(contract.Id, sov.Id, 1));
        await _service.UpdateLineAsync(new UpdateBillingApplicationLineCommand(
            app1.Value!.Id, app1.Value.LineItems![0].Id, 100000m, 0m));
        // Recalculate app1 to update G702 totals
        await _service.RecalculateAsync(app1.Value.Id);
        var app1Refreshed = await _service.GetAsync(app1.Value.Id);

        // App 2: more work, then void
        var app2 = await _service.CreateAsync(CreateCmd(contract.Id, sov.Id, 2));
        await _service.VoidAsync(app2.Value!.Id);

        // App 3: LessPreviousCertificates should come from app 1 not app 2
        var app3 = await _service.CreateAsync(CreateCmd(contract.Id, sov.Id, 3));

        app3.IsSuccess.Should().BeTrue();
        app3.Value!.LessPreviousCertificates.Should().Be(app1Refreshed.Value!.TotalEarnedLessRetainage);
    }
}
