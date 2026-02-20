using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Billing.Features.PrevailingWageValidation;
using Pitbull.Billing.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Entities;

namespace Pitbull.Tests.Unit.Api;

public class PrevailingWageValidationServiceTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid CompanyId = Guid.NewGuid();

    [Fact]
    public async Task ValidatePayrollRun_ReturnsNotFound_WhenRunMissing()
    {
        await using PitbullDbContext db = CreateDb();
        PrevailingWageValidationService service = new(db);

        var result = await service.ValidatePayrollRunAsync(new ValidatePayrollRunPrevailingWageQuery(Guid.NewGuid()));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task ValidatePayrollRun_ReturnsPayPeriodNotFound_WhenMissingPayPeriod()
    {
        await using PitbullDbContext db = CreateDb();
        PayrollRun run = new() { Id = Guid.NewGuid(), CompanyId = CompanyId, PayPeriodId = Guid.NewGuid(), RunDate = new DateOnly(2026, 2, 15) };
        run.Lines.Add(new PayrollRunLine { Id = Guid.NewGuid(), EmployeeId = Guid.NewGuid(), GrossPay = 100m });
        db.Set<PayrollRun>().Add(run);
        await db.SaveChangesAsync();

        PrevailingWageValidationService service = new(db);
        var result = await service.ValidatePayrollRunAsync(new ValidatePayrollRunPrevailingWageQuery(run.Id));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("PAY_PERIOD_NOT_FOUND");
    }

    [Fact]
    public async Task ValidatePayrollRun_ReturnsCompliant_WhenRateMeetsMinimum()
    {
        await using PitbullDbContext db = CreateDb();
        SeedData seed = await SeedScenarioAsync(db, employeeRate: 60m, requiredRate: 57m);

        PrevailingWageValidationService service = new(db);
        var result = await service.ValidatePayrollRunAsync(new ValidatePayrollRunPrevailingWageQuery(seed.RunId));

        result.IsSuccess.Should().BeTrue();
        result.Value!.IsCompliant.Should().BeTrue();
        result.Value.Violations.Should().BeEmpty();
    }

    [Fact]
    public async Task ValidatePayrollRun_FlagsViolation_WhenEmployeeRateBelowMinimum()
    {
        await using PitbullDbContext db = CreateDb();
        SeedData seed = await SeedScenarioAsync(db, employeeRate: 45m, requiredRate: 57m);

        PrevailingWageValidationService service = new(db);
        var result = await service.ValidatePayrollRunAsync(new ValidatePayrollRunPrevailingWageQuery(seed.RunId));

        result.IsSuccess.Should().BeTrue();
        result.Value!.IsCompliant.Should().BeFalse();
        result.Value.Violations.Should().HaveCount(1);
    }

    [Fact]
    public async Task ValidatePayrollRun_UsesLatestActiveDetermination()
    {
        await using PitbullDbContext db = CreateDb();
        SeedData seed = await SeedScenarioAsync(db, employeeRate: 55m, requiredRate: 50m);

        db.Set<WageDetermination>().Add(new WageDetermination
        {
            Id = Guid.NewGuid(),
            CompanyId = CompanyId,
            ProjectId = seed.ProjectId,
            DeterminationNumber = "NEW",
            JurisdictionType = WageJurisdictionType.Federal,
            EffectiveDate = new DateOnly(2026, 2, 1),
            Status = WageDeterminationStatus.Active,
            Rates = [new WageDeterminationRate
            {
                Id = Guid.NewGuid(),
                CompanyId = CompanyId,
                WorkClassificationId = seed.ClassificationId,
                BaseRate = 60m,
                FringeRate = 2m,
                TotalRate = 62m
            }]
        });
        await db.SaveChangesAsync();

        PrevailingWageValidationService service = new(db);
        var result = await service.ValidatePayrollRunAsync(new ValidatePayrollRunPrevailingWageQuery(seed.RunId));

        result.Value!.Violations.Should().HaveCount(1);
        result.Value.Violations[0].RequiredRate.Should().Be(62m);
    }

    [Fact]
    public async Task ValidatePayrollRun_IgnoresProjectsWithoutActiveDeterminations()
    {
        await using PitbullDbContext db = CreateDb();
        SeedData seed = await SeedScenarioAsync(db, employeeRate: 10m, requiredRate: 100m, determinationStatus: WageDeterminationStatus.Expired);

        PrevailingWageValidationService service = new(db);
        var result = await service.ValidatePayrollRunAsync(new ValidatePayrollRunPrevailingWageQuery(seed.RunId));

        result.Value!.IsCompliant.Should().BeTrue();
        result.Value.Violations.Should().BeEmpty();
    }

    [Fact]
    public async Task ValidatePayrollRun_OnlyChecksApprovedEntries()
    {
        await using PitbullDbContext db = CreateDb();
        SeedData seed = await SeedScenarioAsync(db, employeeRate: 40m, requiredRate: 57m, timeStatus: TimeEntryStatus.Draft);

        PrevailingWageValidationService service = new(db);
        var result = await service.ValidatePayrollRunAsync(new ValidatePayrollRunPrevailingWageQuery(seed.RunId));

        result.Value!.Violations.Should().BeEmpty();
    }

    [Fact]
    public async Task ValidatePayrollRun_ReturnsMultipleViolations_WhenMultipleEntriesBelowRate()
    {
        await using PitbullDbContext db = CreateDb();
        SeedData seed = await SeedScenarioAsync(db, employeeRate: 30m, requiredRate: 57m);

        db.Set<TimeEntry>().Add(new TimeEntry
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            CompanyId = CompanyId,
            EmployeeId = seed.EmployeeId,
            ProjectId = seed.ProjectId,
            CostCodeId = Guid.NewGuid(),
            Date = new DateOnly(2026, 2, 12),
            Status = TimeEntryStatus.Approved,
            RegularHours = 4m,
            OvertimeHours = 0,
            DoubletimeHours = 0
        });
        await db.SaveChangesAsync();

        PrevailingWageValidationService service = new(db);
        var result = await service.ValidatePayrollRunAsync(new ValidatePayrollRunPrevailingWageQuery(seed.RunId));

        result.Value!.Violations.Count.Should().Be(2);
    }

    [Fact]
    public async Task ValidatePayrollRun_ComputesVarianceCorrectly()
    {
        await using PitbullDbContext db = CreateDb();
        SeedData seed = await SeedScenarioAsync(db, employeeRate: 42.25m, requiredRate: 57.75m);

        PrevailingWageValidationService service = new(db);
        var result = await service.ValidatePayrollRunAsync(new ValidatePayrollRunPrevailingWageQuery(seed.RunId));

        result.Value!.Violations.Should().ContainSingle();
        result.Value.Violations[0].Variance.Should().Be(15.50m);
    }

    [Fact]
    public async Task ValidatePayrollRun_ReturnsCompliant_WhenNoApprovedEntriesInPeriod()
    {
        await using PitbullDbContext db = CreateDb();
        SeedData seed = await SeedScenarioAsync(db, employeeRate: 10m, requiredRate: 100m, entryDate: new DateOnly(2026, 3, 1));

        PrevailingWageValidationService service = new(db);
        var result = await service.ValidatePayrollRunAsync(new ValidatePayrollRunPrevailingWageQuery(seed.RunId));

        result.Value!.Violations.Should().BeEmpty();
        result.Value.IsCompliant.Should().BeTrue();
    }

    private static PitbullDbContext CreateDb()
    {
        TenantContext tenantContext = new() { TenantId = TenantId, TenantName = "test" };
        CompanyContext companyContext = new() { CompanyId = CompanyId };

        DbContextOptions<PitbullDbContext> options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new PitbullDbContext(options, tenantContext, companyContext);
    }

    private static async Task<SeedData> SeedScenarioAsync(
        PitbullDbContext db,
        decimal employeeRate,
        decimal requiredRate,
        WageDeterminationStatus determinationStatus = WageDeterminationStatus.Active,
        TimeEntryStatus timeStatus = TimeEntryStatus.Approved,
        DateOnly? entryDate = null)
    {
        Guid payPeriodId = Guid.NewGuid();
        Guid runId = Guid.NewGuid();
        Guid lineId = Guid.NewGuid();
        Guid employeeId = Guid.NewGuid();
        Guid projectId = Guid.NewGuid();
        Guid classificationId = Guid.NewGuid();

        PayPeriod payPeriod = new()
        {
            Id = payPeriodId,
            TenantId = TenantId,
            CompanyId = CompanyId,
            StartDate = new DateOnly(2026, 2, 10),
            EndDate = new DateOnly(2026, 2, 16),
            Name = "P1",
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        PayrollRun run = new()
        {
            Id = runId,
            TenantId = TenantId,
            CompanyId = CompanyId,
            PayPeriodId = payPeriodId,
            RunDate = new DateOnly(2026, 2, 16),
            Status = PayrollRunStatus.Submitted,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test",
            Lines = [new PayrollRunLine
            {
                Id = lineId,
                TenantId = TenantId,
                CompanyId = CompanyId,
                EmployeeId = employeeId,
                RegularHours = 8m,
                GrossPay = employeeRate * 8m,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = "test"
            }]
        };

        Employee employee = new()
        {
            Id = employeeId,
            TenantId = TenantId,
            EmployeeNumber = "EMP-0001",
            FirstName = "John",
            LastName = "Worker",
            Classification = EmployeeClassification.Hourly,
            BaseHourlyRate = employeeRate,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        WorkClassification classification = new()
        {
            Id = classificationId,
            TenantId = TenantId,
            CompanyId = CompanyId,
            Code = "CARP",
            Name = "Carpenter",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        WageDetermination determination = new()
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            CompanyId = CompanyId,
            ProjectId = projectId,
            JurisdictionType = WageJurisdictionType.Federal,
            DeterminationNumber = "WD-001",
            EffectiveDate = new DateOnly(2026, 1, 1),
            Status = determinationStatus,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test",
            Rates = [new WageDeterminationRate
            {
                Id = Guid.NewGuid(),
                TenantId = TenantId,
                CompanyId = CompanyId,
                WorkClassificationId = classificationId,
                BaseRate = requiredRate - 5m,
                FringeRate = 5m,
                TotalRate = requiredRate,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = "test"
            }]
        };

        TimeEntry entry = new()
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            CompanyId = CompanyId,
            EmployeeId = employeeId,
            ProjectId = projectId,
            CostCodeId = Guid.NewGuid(),
            Date = entryDate ?? new DateOnly(2026, 2, 11),
            Status = timeStatus,
            RegularHours = 8m,
            OvertimeHours = 0,
            DoubletimeHours = 0,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        db.Set<PayPeriod>().Add(payPeriod);
        db.Set<PayrollRun>().Add(run);
        db.Set<Employee>().Add(employee);
        db.Set<WorkClassification>().Add(classification);
        db.Set<WageDetermination>().Add(determination);
        db.Set<TimeEntry>().Add(entry);
        await db.SaveChangesAsync();

        return new SeedData(runId, employeeId, projectId, classificationId);
    }

    private sealed record SeedData(Guid RunId, Guid EmployeeId, Guid ProjectId, Guid ClassificationId);
}
