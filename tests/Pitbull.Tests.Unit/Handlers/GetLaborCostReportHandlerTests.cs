using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features.GetLaborCostReport;
using Pitbull.TimeTracking.Services;

namespace Pitbull.Tests.Unit.Handlers;

public class GetLaborCostReportHandlerTests
{
    private static readonly Guid TenantId = TestDbContextFactory.TestTenantId;

    private static Project CreateProject(string name, string number)
    {
        return new Project
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            Name = name,
            Number = number
        };
    }

    private static CostCode CreateCostCode(string code, string description)
    {
        return new CostCode
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            Code = code,
            Description = description
        };
    }

    private static Employee CreateEmployee(string firstName, string lastName, decimal hourlyRate)
    {
        return new Employee
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            FirstName = firstName,
            LastName = lastName,
            EmployeeNumber = $"E{Guid.NewGuid().ToString()[..6]}",
            BaseHourlyRate = hourlyRate
        };
    }

    private static TimeEntry CreateTimeEntry(
        Employee employee,
        Project project,
        CostCode costCode,
        DateOnly date,
        decimal regularHours,
        decimal overtimeHours = 0,
        decimal doubletimeHours = 0,
        TimeEntryStatus status = TimeEntryStatus.Approved)
    {
        return new TimeEntry
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            Date = date,
            EmployeeId = employee.Id,
            Employee = employee,
            ProjectId = project.Id,
            Project = project,
            CostCodeId = costCode.Id,
            CostCode = costCode,
            RegularHours = regularHours,
            OvertimeHours = overtimeHours,
            DoubletimeHours = doubletimeHours,
            Status = status
        };
    }

    [Fact]
    public async Task Handle_NoEntries_ReturnsEmptyReport()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var calculator = new LaborCostCalculator();
        var handler = new GetLaborCostReportHandler(db, calculator);
        var query = new GetLaborCostReportQuery();

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCost.TotalHours.Should().Be(0);
        result.Value.TotalCost.TotalCost.Should().Be(0);
        result.Value.ByProject.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_SingleEntry_CalculatesCostCorrectly()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var project = CreateProject("Test Project", "PRJ-001");
        var costCode = CreateCostCode("01-100", "General Labor");
        var employee = CreateEmployee("John", "Doe", 25m); // $25/hr
        var entry = CreateTimeEntry(employee, project, costCode, DateOnly.FromDateTime(DateTime.Today),
            regularHours: 8m);

        db.Set<Project>().Add(project);
        db.Set<CostCode>().Add(costCode);
        db.Set<Employee>().Add(employee);
        db.Set<TimeEntry>().Add(entry);
        await db.SaveChangesAsync();

        var calculator = new LaborCostCalculator();
        var handler = new GetLaborCostReportHandler(db, calculator);
        var query = new GetLaborCostReportQuery();

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var report = result.Value!;

        // Total: 8h × $25 = $200 base, $200 × 0.35 = $70 burden, $270 total
        report.TotalCost.TotalHours.Should().Be(8m);
        report.TotalCost.RegularHours.Should().Be(8m);
        report.TotalCost.BaseWageCost.Should().Be(200m);
        report.TotalCost.BurdenCost.Should().Be(70m);
        report.TotalCost.TotalCost.Should().Be(270m);

        report.ByProject.Should().HaveCount(1);
        report.ByProject[0].ProjectName.Should().Be("Test Project");
        report.ByProject[0].ByCostCode.Should().HaveCount(1);
        report.ByProject[0].ByCostCode[0].CostCodeNumber.Should().Be("01-100");
    }

    [Fact]
    public async Task Handle_MultipleProjects_GroupsCorrectly()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var project1 = CreateProject("Project A", "PRJ-A");
        var project2 = CreateProject("Project B", "PRJ-B");
        var costCode = CreateCostCode("01-100", "General Labor");
        var employee = CreateEmployee("John", "Doe", 20m);

        var entry1 = CreateTimeEntry(employee, project1, costCode, DateOnly.FromDateTime(DateTime.Today),
            regularHours: 8m);
        var entry2 = CreateTimeEntry(employee, project2, costCode, DateOnly.FromDateTime(DateTime.Today),
            regularHours: 4m);

        db.Set<Project>().AddRange(project1, project2);
        db.Set<CostCode>().Add(costCode);
        db.Set<Employee>().Add(employee);
        db.Set<TimeEntry>().AddRange(entry1, entry2);
        await db.SaveChangesAsync();

        var calculator = new LaborCostCalculator();
        var handler = new GetLaborCostReportHandler(db, calculator);
        var query = new GetLaborCostReportQuery();

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var report = result.Value!;

        report.TotalCost.TotalHours.Should().Be(12m);
        report.ByProject.Should().HaveCount(2);

        // Ordered by project number
        report.ByProject[0].ProjectNumber.Should().Be("PRJ-A");
        report.ByProject[0].Cost.TotalHours.Should().Be(8m);
        report.ByProject[1].ProjectNumber.Should().Be("PRJ-B");
        report.ByProject[1].Cost.TotalHours.Should().Be(4m);
    }

    [Fact]
    public async Task Handle_MultipleCostCodes_GroupsWithinProject()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var project = CreateProject("Test Project", "PRJ-001");
        var costCode1 = CreateCostCode("01-100", "General Labor");
        var costCode2 = CreateCostCode("02-200", "Equipment Operation");
        var employee = CreateEmployee("John", "Doe", 30m);

        var entry1 = CreateTimeEntry(employee, project, costCode1, DateOnly.FromDateTime(DateTime.Today),
            regularHours: 8m);
        var entry2 = CreateTimeEntry(employee, project, costCode2, DateOnly.FromDateTime(DateTime.Today),
            regularHours: 4m, overtimeHours: 2m);

        db.Set<Project>().Add(project);
        db.Set<CostCode>().AddRange(costCode1, costCode2);
        db.Set<Employee>().Add(employee);
        db.Set<TimeEntry>().AddRange(entry1, entry2);
        await db.SaveChangesAsync();

        var calculator = new LaborCostCalculator();
        var handler = new GetLaborCostReportHandler(db, calculator);
        var query = new GetLaborCostReportQuery();

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var report = result.Value!;

        report.ByProject.Should().HaveCount(1);
        var projectReport = report.ByProject[0];

        projectReport.ByCostCode.Should().HaveCount(2);
        // Ordered by cost code number
        projectReport.ByCostCode[0].CostCodeNumber.Should().Be("01-100");
        projectReport.ByCostCode[1].CostCodeNumber.Should().Be("02-200");

        // Cost code 2 has OT
        projectReport.ByCostCode[1].Cost.OvertimeHours.Should().Be(2m);
    }

    [Fact]
    public async Task Handle_ApprovedOnlyTrue_ExcludesNonApprovedEntries()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var project = CreateProject("Test Project", "PRJ-001");
        var costCode = CreateCostCode("01-100", "General Labor");
        var employee = CreateEmployee("John", "Doe", 25m);

        var entry1 = CreateTimeEntry(employee, project, costCode, DateOnly.FromDateTime(DateTime.Today),
            regularHours: 8m, status: TimeEntryStatus.Approved);
        var entry2 = CreateTimeEntry(employee, project, costCode, DateOnly.FromDateTime(DateTime.Today),
            regularHours: 4m, status: TimeEntryStatus.Submitted);
        var entry3 = CreateTimeEntry(employee, project, costCode, DateOnly.FromDateTime(DateTime.Today),
            regularHours: 2m, status: TimeEntryStatus.Rejected);

        db.Set<Project>().Add(project);
        db.Set<CostCode>().Add(costCode);
        db.Set<Employee>().Add(employee);
        db.Set<TimeEntry>().AddRange(entry1, entry2, entry3);
        await db.SaveChangesAsync();

        var calculator = new LaborCostCalculator();
        var handler = new GetLaborCostReportHandler(db, calculator);
        var query = new GetLaborCostReportQuery(ApprovedOnly: true);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCost.TotalHours.Should().Be(8m); // Only approved entry
    }

    [Fact]
    public async Task Handle_ApprovedOnlyFalse_IncludesAllEntries()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var project = CreateProject("Test Project", "PRJ-001");
        var costCode = CreateCostCode("01-100", "General Labor");
        var employee = CreateEmployee("John", "Doe", 25m);

        var entry1 = CreateTimeEntry(employee, project, costCode, DateOnly.FromDateTime(DateTime.Today),
            regularHours: 8m, status: TimeEntryStatus.Approved);
        var entry2 = CreateTimeEntry(employee, project, costCode, DateOnly.FromDateTime(DateTime.Today),
            regularHours: 4m, status: TimeEntryStatus.Submitted);

        db.Set<Project>().Add(project);
        db.Set<CostCode>().Add(costCode);
        db.Set<Employee>().Add(employee);
        db.Set<TimeEntry>().AddRange(entry1, entry2);
        await db.SaveChangesAsync();

        var calculator = new LaborCostCalculator();
        var handler = new GetLaborCostReportHandler(db, calculator);
        var query = new GetLaborCostReportQuery(ApprovedOnly: false);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCost.TotalHours.Should().Be(12m); // Both entries
    }

    [Fact]
    public async Task Handle_ProjectFilter_OnlyIncludesSpecifiedProject()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var project1 = CreateProject("Project A", "PRJ-A");
        var project2 = CreateProject("Project B", "PRJ-B");
        var costCode = CreateCostCode("01-100", "General Labor");
        var employee = CreateEmployee("John", "Doe", 20m);

        var entry1 = CreateTimeEntry(employee, project1, costCode, DateOnly.FromDateTime(DateTime.Today),
            regularHours: 8m);
        var entry2 = CreateTimeEntry(employee, project2, costCode, DateOnly.FromDateTime(DateTime.Today),
            regularHours: 4m);

        db.Set<Project>().AddRange(project1, project2);
        db.Set<CostCode>().Add(costCode);
        db.Set<Employee>().Add(employee);
        db.Set<TimeEntry>().AddRange(entry1, entry2);
        await db.SaveChangesAsync();

        var calculator = new LaborCostCalculator();
        var handler = new GetLaborCostReportHandler(db, calculator);
        var query = new GetLaborCostReportQuery(ProjectId: project1.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCost.TotalHours.Should().Be(8m);
        result.Value.ByProject.Should().HaveCount(1);
        result.Value.ByProject[0].ProjectId.Should().Be(project1.Id);
    }

    [Fact]
    public async Task Handle_NonexistentProject_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var calculator = new LaborCostCalculator();
        var handler = new GetLaborCostReportHandler(db, calculator);
        var query = new GetLaborCostReportQuery(ProjectId: Guid.NewGuid());

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task Handle_DateRangeFilter_OnlyIncludesEntriesInRange()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var project = CreateProject("Test Project", "PRJ-001");
        var costCode = CreateCostCode("01-100", "General Labor");
        var employee = CreateEmployee("John", "Doe", 25m);

        var today = DateOnly.FromDateTime(DateTime.Today);
        var entry1 = CreateTimeEntry(employee, project, costCode, today.AddDays(-5), regularHours: 8m);
        var entry2 = CreateTimeEntry(employee, project, costCode, today.AddDays(-2), regularHours: 4m);
        var entry3 = CreateTimeEntry(employee, project, costCode, today, regularHours: 2m);

        db.Set<Project>().Add(project);
        db.Set<CostCode>().Add(costCode);
        db.Set<Employee>().Add(employee);
        db.Set<TimeEntry>().AddRange(entry1, entry2, entry3);
        await db.SaveChangesAsync();

        var calculator = new LaborCostCalculator();
        var handler = new GetLaborCostReportHandler(db, calculator);
        var query = new GetLaborCostReportQuery(
            StartDate: today.AddDays(-3),
            EndDate: today.AddDays(-1));

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCost.TotalHours.Should().Be(4m); // Only the -2 days entry
    }

    [Fact]
    public async Task Handle_OvertimeAndDoubletime_CalculatesCostWithMultipliers()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var project = CreateProject("Test Project", "PRJ-001");
        var costCode = CreateCostCode("01-100", "General Labor");
        var employee = CreateEmployee("John", "Doe", 40m); // $40/hr

        var entry = CreateTimeEntry(employee, project, costCode, DateOnly.FromDateTime(DateTime.Today),
            regularHours: 8m, overtimeHours: 2m, doubletimeHours: 1m);

        db.Set<Project>().Add(project);
        db.Set<CostCode>().Add(costCode);
        db.Set<Employee>().Add(employee);
        db.Set<TimeEntry>().Add(entry);
        await db.SaveChangesAsync();

        var calculator = new LaborCostCalculator();
        var handler = new GetLaborCostReportHandler(db, calculator);
        var query = new GetLaborCostReportQuery();

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var cost = result.Value!.TotalCost;

        // Regular: 8 × $40 = $320
        // OT: 2 × $40 × 1.5 = $120
        // DT: 1 × $40 × 2.0 = $80
        // Base: $520
        cost.BaseWageCost.Should().Be(520m);

        // Burden: $520 × 0.35 = $182
        cost.BurdenCost.Should().Be(182m);

        // Total: $520 + $182 = $702
        cost.TotalCost.Should().Be(702m);
    }
}
