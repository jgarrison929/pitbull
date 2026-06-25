using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Billing.Features.Wip;
using Pitbull.Billing.Services;
using Pitbull.Contracts.Domain;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Tests.Unit.Services;

public class WipCalculationServiceTests
{
    [Fact]
    public async Task CalculateProjectLineAsync_KnownInputs_ReturnsExpectedValues()
    {
        using Pitbull.Core.Data.PitbullDbContext db = TestDbContextFactory.Create();

        Project project = new()
        {
            Id = Guid.NewGuid(),
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            Name = "North Campus",
            Number = "PRJ-100",
            Status = ProjectStatus.Active,
            ContractAmount = 100_000m,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        Subcontract subcontract = new()
        {
            Id = Guid.NewGuid(),
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            ProjectId = project.Id,
            SubcontractNumber = "SC-100",
            SubcontractorName = "Demo Subs",
            ScopeOfWork = "Concrete",
            OriginalValue = 25_000m,
            CurrentValue = 25_000m,
            Status = SubcontractStatus.InProgress,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        ChangeOrder approvedChangeOrder = new()
        {
            Id = Guid.NewGuid(),
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            SubcontractId = subcontract.Id,
            ChangeOrderNumber = "CO-1",
            Title = "Owner Add",
            Description = "Scope add",
            Amount = 10_000m,
            Status = ChangeOrderStatus.Approved,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        ChangeOrder pendingChangeOrder = new()
        {
            Id = Guid.NewGuid(),
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            SubcontractId = subcontract.Id,
            ChangeOrderNumber = "CO-2",
            Title = "Pending",
            Description = "Pending scope",
            Amount = 5_000m,
            Status = ChangeOrderStatus.Pending,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        OwnerContract ownerContract = new()
        {
            Id = Guid.NewGuid(),
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            ProjectId = project.Id,
            ContractNumber = "OC-100",
            ProjectName = "North Campus",
            OriginalContractSum = 100_000m,
            ContractSumToDate = 100_000m,
            DefaultRetainagePercent = 10m,
            RetainagePercentMaterials = 10m,
            Status = OwnerContractStatus.Active,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        BillingApplication submittedBillingApp = new()
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
            TotalEarnedLessRetainage = 30_000m,
            Status = BillingApplicationStatus.SubmittedToOwner,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        BillingApplication draftBillingApp = new()
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
            TotalEarnedLessRetainage = 50_000m,
            Status = BillingApplicationStatus.Draft,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        Employee employee = new()
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeNumber = "E-100",
            FirstName = "Demo",
            LastName = "Employee",
            Classification = EmployeeClassification.Hourly,
            BaseHourlyRate = 50m,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        Equipment equipment = new()
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            Code = "EQ-100",
            Name = "Skid Steer",
            Type = EquipmentType.Vehicles,
            HourlyRate = 100m,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        TimeEntry timeEntry = new()
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            EmployeeId = employee.Id,
            ProjectId = project.Id,
            CostCodeId = Guid.NewGuid(),
            EquipmentId = equipment.Id,
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
            RegularHours = 10m,
            OvertimeHours = 2m,
            DoubletimeHours = 1m,
            EquipmentHours = 3m,
            Status = TimeEntryStatus.Approved,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        db.Set<Project>().Add(project);
        db.Set<Subcontract>().Add(subcontract);
        db.Set<ChangeOrder>().Add(approvedChangeOrder);
        db.Set<ChangeOrder>().Add(pendingChangeOrder);
        db.Set<OwnerContract>().Add(ownerContract);
        db.Set<BillingApplication>().Add(submittedBillingApp);
        db.Set<BillingApplication>().Add(draftBillingApp);
        db.Set<Employee>().Add(employee);
        db.Set<Equipment>().Add(equipment);
        db.Set<TimeEntry>().Add(timeEntry);
        await db.SaveChangesAsync();

        IWipCalculationService service = new WipCalculationService(db);

        var result = await service.CalculateProjectLineAsync(project, estimatedCostToComplete: 950m);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();

        WipReportLineCalculationResult line = result.Value!;
        line.ContractAmount.Should().Be(100_000m);
        line.ApprovedChangeOrders.Should().Be(10_000m);
        line.RevisedContractAmount.Should().Be(110_000m);
        line.TotalCostToDate.Should().Be(1_050m);
        line.EstimatedTotalCost.Should().Be(2_000m);
        line.PercentComplete.Should().Be(0.525m);
        line.EarnedRevenue.Should().Be(57_750m);
        line.BilledToDate.Should().Be(30_000m);
        line.OverUnderBilling.Should().Be(27_750m);
        line.OverUnderClassification.Should().Be(WipOverUnderClassification.UnderBilled);
    }

    [Theory]
    [InlineData(100, WipOverUnderClassification.UnderBilled)]
    [InlineData(-100, WipOverUnderClassification.OverBilled)]
    [InlineData(0, WipOverUnderClassification.Flat)]
    public void OverUnderClassification_ReturnsExpected(int overUnderBilling, WipOverUnderClassification expected)
    {
        WipOverUnderClassification actual = WipMapper.ClassifyOverUnder(overUnderBilling);
        actual.Should().Be(expected);
    }

    [Fact]
    public async Task GenerateWipReportAsync_CreatesReportForActiveProjectsFromProjectData()
    {
        using Pitbull.Core.Data.PitbullDbContext db = TestDbContextFactory.Create();

        Project activeProject = new()
        {
            Id = Guid.NewGuid(),
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            Name = "Active Project",
            Number = "PRJ-ACTIVE",
            Status = ProjectStatus.Active,
            ContractAmount = 50_000m,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        Project closedProject = new()
        {
            Id = Guid.NewGuid(),
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            Name = "Closed Project",
            Number = "PRJ-CLOSED",
            Status = ProjectStatus.Closed,
            ContractAmount = 75_000m,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        db.Set<Project>().Add(activeProject);
        db.Set<Project>().Add(closedProject);
        await db.SaveChangesAsync();

        IWipCalculationService calcService = new WipCalculationService(db);
        IWipReportService reportService = new WipReportService(db, calcService, NullLogger<WipReportService>.Instance);

        GenerateWipReportCommand command = new(
            ReportDate: DateOnly.FromDateTime(DateTime.UtcNow),
            FiscalYear: 2026,
            PeriodNumber: 2,
            ProjectEstimates: [new WipProjectEstimateInput(activeProject.Id, 10_000m)]);

        var result = await reportService.GenerateWipReportAsync(command, generatedById: "admin-user");

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();

        WipReportDto report = result.Value!;
        report.FiscalYear.Should().Be(2026);
        report.PeriodNumber.Should().Be(2);
        report.GeneratedById.Should().Be("admin-user");
        report.Lines.Should().HaveCount(1);
        report.Lines[0].ProjectId.Should().Be(activeProject.Id);
        report.Lines[0].ContractAmount.Should().Be(50_000m);
    }
}
