using FluentAssertions;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features.ExportVistaTimesheet;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class ExportVistaTimesheetHandlerTests
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

    private static Employee CreateEmployee(string firstName, string lastName, decimal hourlyRate, string? empNumber = null)
    {
        return new Employee
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            FirstName = firstName,
            LastName = lastName,
            EmployeeNumber = empNumber ?? $"E{Guid.NewGuid().ToString()[..6]}",
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
    public async Task Handle_NoEntries_ReturnsEmptyExportWithHeaders()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new ExportVistaTimesheetHandler(db);
        var today = DateOnly.FromDateTime(DateTime.Today);
        var query = new ExportVistaTimesheetQuery(today.AddDays(-7), today);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var export = result.Value!;

        export.RowCount.Should().Be(0);
        export.TotalHours.Should().Be(0);
        export.CsvContent.Should().Contain("EmployeeNumber");
        export.CsvContent.Should().Contain("WorkDate");
        export.FileName.Should().Contain("vista-timesheet");
    }

    [Fact]
    public async Task Handle_SingleApprovedEntry_GeneratesCorrectCsv()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var project = CreateProject("Test Project", "PRJ-001");
        var costCode = CreateCostCode("01-100", "General Labor");
        var employee = CreateEmployee("John", "Doe", 25m, "EMP001");
        var today = DateOnly.FromDateTime(DateTime.Today);
        var entry = CreateTimeEntry(employee, project, costCode, today, regularHours: 8m);

        db.Set<Project>().Add(project);
        db.Set<CostCode>().Add(costCode);
        db.Set<Employee>().Add(employee);
        db.Set<TimeEntry>().Add(entry);
        await db.SaveChangesAsync();

        var handler = new ExportVistaTimesheetHandler(db);
        var query = new ExportVistaTimesheetQuery(today.AddDays(-1), today);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var export = result.Value!;

        export.RowCount.Should().Be(1);
        export.TotalHours.Should().Be(8m);
        export.EmployeeCount.Should().Be(1);
        export.ProjectCount.Should().Be(1);

        // Verify CSV content
        export.CsvContent.Should().Contain("EMP001");
        export.CsvContent.Should().Contain("John Doe");
        export.CsvContent.Should().Contain("PRJ-001");
        export.CsvContent.Should().Contain("01-100");
        export.CsvContent.Should().Contain("8.00"); // Regular hours
        export.CsvContent.Should().Contain("200.00"); // 8 * $25
    }

    [Fact]
    public async Task Handle_OvertimeAndDoubletime_CalculatesAmountsWithMultipliers()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var project = CreateProject("Test Project", "PRJ-001");
        var costCode = CreateCostCode("01-100", "General Labor");
        var employee = CreateEmployee("John", "Doe", 40m, "EMP001");
        var today = DateOnly.FromDateTime(DateTime.Today);
        var entry = CreateTimeEntry(employee, project, costCode, today,
            regularHours: 8m, overtimeHours: 2m, doubletimeHours: 1m);

        db.Set<Project>().Add(project);
        db.Set<CostCode>().Add(costCode);
        db.Set<Employee>().Add(employee);
        db.Set<TimeEntry>().Add(entry);
        await db.SaveChangesAsync();

        var handler = new ExportVistaTimesheetHandler(db);
        var query = new ExportVistaTimesheetQuery(today, today);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var export = result.Value!;

        export.TotalHours.Should().Be(11m);

        // Regular: 8 * $40 = $320
        // OT: 2 * $40 * 1.5 = $120
        // DT: 1 * $40 * 2.0 = $80
        // Total: $520
        export.CsvContent.Should().Contain("320.00"); // Regular amount
        export.CsvContent.Should().Contain("120.00"); // OT amount
        export.CsvContent.Should().Contain("80.00"); // DT amount
        export.CsvContent.Should().Contain("520.00"); // Total amount
    }

    [Fact]
    public async Task Handle_ExcludesNonApprovedEntries()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var project = CreateProject("Test Project", "PRJ-001");
        var costCode = CreateCostCode("01-100", "General Labor");
        var employee = CreateEmployee("John", "Doe", 25m);
        var today = DateOnly.FromDateTime(DateTime.Today);

        var approvedEntry = CreateTimeEntry(employee, project, costCode, today,
            regularHours: 8m, status: TimeEntryStatus.Approved);
        var submittedEntry = CreateTimeEntry(employee, project, costCode, today,
            regularHours: 4m, status: TimeEntryStatus.Submitted);
        var rejectedEntry = CreateTimeEntry(employee, project, costCode, today,
            regularHours: 2m, status: TimeEntryStatus.Rejected);
        var draftEntry = CreateTimeEntry(employee, project, costCode, today,
            regularHours: 1m, status: TimeEntryStatus.Draft);

        db.Set<Project>().Add(project);
        db.Set<CostCode>().Add(costCode);
        db.Set<Employee>().Add(employee);
        db.Set<TimeEntry>().AddRange(approvedEntry, submittedEntry, rejectedEntry, draftEntry);
        await db.SaveChangesAsync();

        var handler = new ExportVistaTimesheetHandler(db);
        var query = new ExportVistaTimesheetQuery(today, today);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.RowCount.Should().Be(1);
        result.Value.TotalHours.Should().Be(8m);
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

        var handler = new ExportVistaTimesheetHandler(db);
        var query = new ExportVistaTimesheetQuery(today.AddDays(-3), today.AddDays(-1));

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.RowCount.Should().Be(1);
        result.Value.TotalHours.Should().Be(4m);
    }

    [Fact]
    public async Task Handle_ProjectFilter_OnlyIncludesSpecifiedProject()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var project1 = CreateProject("Project A", "PRJ-A");
        var project2 = CreateProject("Project B", "PRJ-B");
        var costCode = CreateCostCode("01-100", "General Labor");
        var employee = CreateEmployee("John", "Doe", 25m);
        var today = DateOnly.FromDateTime(DateTime.Today);

        var entry1 = CreateTimeEntry(employee, project1, costCode, today, regularHours: 8m);
        var entry2 = CreateTimeEntry(employee, project2, costCode, today, regularHours: 4m);

        db.Set<Project>().AddRange(project1, project2);
        db.Set<CostCode>().Add(costCode);
        db.Set<Employee>().Add(employee);
        db.Set<TimeEntry>().AddRange(entry1, entry2);
        await db.SaveChangesAsync();

        var handler = new ExportVistaTimesheetHandler(db);
        var query = new ExportVistaTimesheetQuery(today, today, project1.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.RowCount.Should().Be(1);
        result.Value.TotalHours.Should().Be(8m);
        result.Value.ProjectCount.Should().Be(1);
        result.Value.CsvContent.Should().Contain("PRJ-A");
        result.Value.CsvContent.Should().NotContain("PRJ-B");
    }

    [Fact]
    public async Task Handle_InvalidDateRange_ReturnsError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new ExportVistaTimesheetHandler(db);
        var today = DateOnly.FromDateTime(DateTime.Today);
        var query = new ExportVistaTimesheetQuery(today, today.AddDays(-5)); // End before start

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_DATE_RANGE");
    }

    [Fact]
    public async Task Handle_DateRangeTooLarge_ReturnsError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new ExportVistaTimesheetHandler(db);
        var today = DateOnly.FromDateTime(DateTime.Today);
        var query = new ExportVistaTimesheetQuery(today.AddDays(-400), today); // >366 days

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("DATE_RANGE_TOO_LARGE");
    }

    [Fact]
    public async Task Handle_NonexistentProject_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new ExportVistaTimesheetHandler(db);
        var today = DateOnly.FromDateTime(DateTime.Today);
        var query = new ExportVistaTimesheetQuery(today, today, Guid.NewGuid());

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task Handle_MultipleEmployees_OrdersByEmployeeNumber()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var project = CreateProject("Test Project", "PRJ-001");
        var costCode = CreateCostCode("01-100", "General Labor");
        var employee1 = CreateEmployee("John", "Doe", 25m, "EMP002");
        var employee2 = CreateEmployee("Jane", "Smith", 30m, "EMP001");
        var today = DateOnly.FromDateTime(DateTime.Today);

        var entry1 = CreateTimeEntry(employee1, project, costCode, today, regularHours: 8m);
        var entry2 = CreateTimeEntry(employee2, project, costCode, today, regularHours: 4m);

        db.Set<Project>().Add(project);
        db.Set<CostCode>().Add(costCode);
        db.Set<Employee>().AddRange(employee1, employee2);
        db.Set<TimeEntry>().AddRange(entry1, entry2);
        await db.SaveChangesAsync();

        var handler = new ExportVistaTimesheetHandler(db);
        var query = new ExportVistaTimesheetQuery(today, today);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.EmployeeCount.Should().Be(2);

        // EMP001 should come before EMP002
        var csv = result.Value.CsvContent;
        var emp001Index = csv.IndexOf("EMP001");
        var emp002Index = csv.IndexOf("EMP002");
        emp001Index.Should().BeLessThan(emp002Index);
    }

    [Fact]
    public async Task Handle_SpecialCharactersInData_EscapesCorrectly()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var project = CreateProject("Test, \"Special\" Project", "PRJ-001");
        var costCode = CreateCostCode("01-100", "Labor, General");
        var employee = CreateEmployee("John", "O'Brien", 25m);
        var today = DateOnly.FromDateTime(DateTime.Today);
        var entry = CreateTimeEntry(employee, project, costCode, today, regularHours: 8m);

        db.Set<Project>().Add(project);
        db.Set<CostCode>().Add(costCode);
        db.Set<Employee>().Add(employee);
        db.Set<TimeEntry>().Add(entry);
        await db.SaveChangesAsync();

        var handler = new ExportVistaTimesheetHandler(db);
        var query = new ExportVistaTimesheetQuery(today, today);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();

        // CSV should properly escape the fields with commas and quotes
        var csv = result.Value!.CsvContent;
        csv.Should().Contain("\"Test, \"\"Special\"\" Project\""); // Escaped project name
        csv.Should().Contain("\"Labor, General\""); // Escaped cost code description
    }

    [Fact]
    public async Task Handle_GeneratesCorrectFilename()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new ExportVistaTimesheetHandler(db);
        var startDate = new DateOnly(2026, 2, 1);
        var endDate = new DateOnly(2026, 2, 7);
        var query = new ExportVistaTimesheetQuery(startDate, endDate);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.FileName.Should().Be("vista-timesheet-20260201-20260207.csv");
    }
}
