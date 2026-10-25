using FluentAssertions;
using Pitbull.Billing.Domain;
using Pitbull.Billing.Services;
using Pitbull.Contracts.Domain;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Tests.Unit.Services;

/// <summary>
/// Characterization tests that drive <see cref="WipCalculationService"/> on the real entry point
/// and document known source gaps for the financial-math arc
/// (<c>docs/roadmap/financial-math-wip-arc.md</c>).
/// When B2/B3/B4 land, invert or replace these assertions — they lock current behavior intentionally.
/// </summary>
public class WipCalculationSourceGapTests
{
    private static Project NewProject(decimal contractAmount = 100_000m) => new()
    {
        Id = Guid.NewGuid(),
        CompanyId = TestDbContextFactory.TestCompanyId,
        TenantId = TestDbContextFactory.TestTenantId,
        Name = "Gap Project",
        Number = "PRJ-GAP",
        Status = ProjectStatus.Active,
        ContractAmount = contractAmount,
        CreatedAt = DateTime.UtcNow,
        CreatedBy = "test"
    };

    [Fact]
    public async Task ApprovedChangeOrders_IgnoresOwnerChangeOrders_UsesSubcontractOnly()
    {
        using var db = TestDbContextFactory.Create();
        Project project = NewProject();

        // Owner/main CO — should revise GC WIP contract but is ignored today (arc M3).
        OwnerChangeOrder ownerCo = new()
        {
            Id = Guid.NewGuid(),
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            ProjectId = project.Id,
            ChangeOrderNumber = "OCO-1",
            Title = "Owner add",
            Description = "Scope add",
            Amount = 25_000m,
            Status = ChangeOrderStatus.Approved,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        Subcontract subcontract = new()
        {
            Id = Guid.NewGuid(),
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            ProjectId = project.Id,
            SubcontractNumber = "SC-GAP",
            SubcontractorName = "Sub",
            ScopeOfWork = "Concrete",
            OriginalValue = 10_000m,
            CurrentValue = 10_000m,
            Status = SubcontractStatus.InProgress,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        ChangeOrder subCo = new()
        {
            Id = Guid.NewGuid(),
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            SubcontractId = subcontract.Id,
            ChangeOrderNumber = "SCO-1",
            Title = "Sub CO",
            Description = "Sub add",
            Amount = 1_000m,
            Status = ChangeOrderStatus.Approved,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        db.Set<Project>().Add(project);
        db.Set<OwnerChangeOrder>().Add(ownerCo);
        db.Set<Subcontract>().Add(subcontract);
        db.Set<ChangeOrder>().Add(subCo);
        await db.SaveChangesAsync();

        var result = await new WipCalculationService(db)
            .CalculateProjectLineAsync(project, estimatedCostToComplete: 0m);

        result.IsSuccess.Should().BeTrue();
        // Current shipped behavior: only subcontract COs.
        result.Value!.ApprovedChangeOrders.Should().Be(1_000m);
        result.Value.RevisedContractAmount.Should().Be(101_000m);
        // Documents gap: owner CO $25k is not in revised contract.
        result.Value.ApprovedChangeOrders.Should().NotBe(26_000m);
        result.Value.ApprovedChangeOrders.Should().NotBe(25_000m);
    }

    [Fact]
    public async Task TotalCostToDate_UsesApprovedTimeEntryOnly_ZeroWithoutLabor()
    {
        using var db = TestDbContextFactory.Create();
        Project project = NewProject();
        db.Set<Project>().Add(project);
        await db.SaveChangesAsync();

        var result = await new WipCalculationService(db)
            .CalculateProjectLineAsync(project, estimatedCostToComplete: 50_000m);

        result.IsSuccess.Should().BeTrue();
        // No time entries → cost 0 even if project has contract (arc M4 job-cost hole).
        result.Value!.TotalCostToDate.Should().Be(0m);
        result.Value.PercentComplete.Should().Be(0m);
        result.Value.EarnedRevenue.Should().Be(0m);
    }

    [Fact]
    public async Task BilledToDate_SumsTotalEarnedLessRetainage_NotGrossCompleted()
    {
        using var db = TestDbContextFactory.Create();
        Project project = NewProject();

        OwnerContract ownerContract = new()
        {
            Id = Guid.NewGuid(),
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            ProjectId = project.Id,
            ContractNumber = "OC-GAP",
            ProjectName = project.Name,
            OriginalContractSum = 100_000m,
            ContractSumToDate = 100_000m,
            DefaultRetainagePercent = 10m,
            RetainagePercentMaterials = 10m,
            Status = OwnerContractStatus.Active,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        // Gross completed 40k; net after retainage 36k — calc uses net field only (arc M6).
        BillingApplication app = new()
        {
            Id = Guid.NewGuid(),
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            ProjectId = project.Id,
            OwnerContractId = ownerContract.Id,
            OwnerScheduleOfValuesId = Guid.NewGuid(),
            ApplicationNumber = 1,
            PeriodFrom = new DateOnly(2026, 1, 1),
            PeriodThrough = new DateOnly(2026, 1, 31),
            ApplicationDate = new DateOnly(2026, 1, 25),
            TotalCompletedAndStoredToDate = 40_000m,
            TotalEarnedLessRetainage = 36_000m,
            Status = BillingApplicationStatus.SubmittedToOwner,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        db.Set<Project>().Add(project);
        db.Set<OwnerContract>().Add(ownerContract);
        db.Set<BillingApplication>().Add(app);
        await db.SaveChangesAsync();

        var result = await new WipCalculationService(db)
            .CalculateProjectLineAsync(project, estimatedCostToComplete: 0m);

        result.IsSuccess.Should().BeTrue();
        result.Value!.BilledToDate.Should().Be(36_000m);
        result.Value.BilledToDate.Should().NotBe(40_000m);
    }

    [Fact]
    public async Task PercentComplete_IsUnitFraction_NotPercentPoints()
    {
        using var db = TestDbContextFactory.Create();
        Project project = NewProject(contractAmount: 100_000m);

        Employee employee = new()
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeNumber = "E-GAP",
            FirstName = "Gap",
            LastName = "Worker",
            Classification = EmployeeClassification.Hourly,
            BaseHourlyRate = 100m,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        // 100 regular hours × $100 = $10,000 cost; ECTC $10,000 → 50% complete as 0.5 not 50.
        TimeEntry timeEntry = new()
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            EmployeeId = employee.Id,
            ProjectId = project.Id,
            CostCodeId = Guid.NewGuid(),
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
            RegularHours = 100m,
            OvertimeHours = 0m,
            DoubletimeHours = 0m,
            EquipmentHours = 0m,
            Status = TimeEntryStatus.Approved,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        db.Set<Project>().Add(project);
        db.Set<Employee>().Add(employee);
        db.Set<TimeEntry>().Add(timeEntry);
        await db.SaveChangesAsync();

        var result = await new WipCalculationService(db)
            .CalculateProjectLineAsync(project, estimatedCostToComplete: 10_000m);

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCostToDate.Should().Be(10_000m);
        result.Value.PercentComplete.Should().Be(0.5m);
        result.Value.PercentComplete.Should().BeLessThan(1.0001m);
        result.Value.EarnedRevenue.Should().Be(50_000m);
    }

    [Fact]
    public async Task BilledToDate_UsesLatestCumulativeTotalEarnedLessRetainage_PerOwnerContract()
    {
        // G702 Line 6 is cumulative on each application. B0: latest ApplicationNumber per contract
        // (RoleDashboardSummaryService pattern) — not sum of all apps (would double-count).
        using var db = TestDbContextFactory.Create();
        Project project = NewProject();

        OwnerContract ownerContract = new()
        {
            Id = Guid.NewGuid(),
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            ProjectId = project.Id,
            ContractNumber = "OC-MULTI",
            ProjectName = project.Name,
            OriginalContractSum = 100_000m,
            ContractSumToDate = 100_000m,
            DefaultRetainagePercent = 10m,
            RetainagePercentMaterials = 10m,
            Status = OwnerContractStatus.Active,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        BillingApplication app1 = new()
        {
            Id = Guid.NewGuid(),
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            ProjectId = project.Id,
            OwnerContractId = ownerContract.Id,
            OwnerScheduleOfValuesId = Guid.NewGuid(),
            ApplicationNumber = 1,
            PeriodFrom = new DateOnly(2026, 1, 1),
            PeriodThrough = new DateOnly(2026, 1, 31),
            ApplicationDate = new DateOnly(2026, 1, 25),
            TotalCompletedAndStoredToDate = 30_000m,
            TotalEarnedLessRetainage = 27_000m, // cumulative through app 1
            Status = BillingApplicationStatus.Paid,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        BillingApplication app2 = new()
        {
            Id = Guid.NewGuid(),
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            ProjectId = project.Id,
            OwnerContractId = ownerContract.Id,
            OwnerScheduleOfValuesId = Guid.NewGuid(),
            ApplicationNumber = 2,
            PeriodFrom = new DateOnly(2026, 2, 1),
            PeriodThrough = new DateOnly(2026, 2, 28),
            ApplicationDate = new DateOnly(2026, 2, 25),
            TotalCompletedAndStoredToDate = 50_000m,
            TotalEarnedLessRetainage = 45_000m, // cumulative through app 2 (includes app1 work)
            Status = BillingApplicationStatus.SubmittedToOwner,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        db.Set<Project>().Add(project);
        db.Set<OwnerContract>().Add(ownerContract);
        db.Set<BillingApplication>().Add(app1);
        db.Set<BillingApplication>().Add(app2);
        await db.SaveChangesAsync();

        var result = await new WipCalculationService(db)
            .CalculateProjectLineAsync(project, estimatedCostToComplete: 0m);

        result.IsSuccess.Should().BeTrue();
        // B0: latest cumulative TELR only (45k). Old sum-all-apps was 27k+45k=72k.
        result.Value!.BilledToDate.Should().Be(45_000m);
        result.Value.BilledToDate.Should().NotBe(72_000m);
        result.Value.BilledToDate.Should().NotBe(27_000m + 45_000m);
    }

    [Fact]
    public async Task DraftBillingApplication_IsExcludedFromBilledToDate()
    {
        using var db = TestDbContextFactory.Create();
        Project project = NewProject();

        OwnerContract ownerContract = new()
        {
            Id = Guid.NewGuid(),
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            ProjectId = project.Id,
            ContractNumber = "OC-DRAFT",
            ProjectName = project.Name,
            OriginalContractSum = 100_000m,
            ContractSumToDate = 100_000m,
            DefaultRetainagePercent = 10m,
            RetainagePercentMaterials = 10m,
            Status = OwnerContractStatus.Active,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        BillingApplication draft = new()
        {
            Id = Guid.NewGuid(),
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            ProjectId = project.Id,
            OwnerContractId = ownerContract.Id,
            OwnerScheduleOfValuesId = Guid.NewGuid(),
            ApplicationNumber = 1,
            PeriodFrom = new DateOnly(2026, 1, 1),
            PeriodThrough = new DateOnly(2026, 1, 31),
            ApplicationDate = new DateOnly(2026, 1, 25),
            TotalEarnedLessRetainage = 99_000m,
            Status = BillingApplicationStatus.Draft,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        db.Set<Project>().Add(project);
        db.Set<OwnerContract>().Add(ownerContract);
        db.Set<BillingApplication>().Add(draft);
        await db.SaveChangesAsync();

        var result = await new WipCalculationService(db)
            .CalculateProjectLineAsync(project, estimatedCostToComplete: 0m);

        result.IsSuccess.Should().BeTrue();
        result.Value!.BilledToDate.Should().Be(0m);
    }
}
