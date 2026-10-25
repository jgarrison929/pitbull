using FluentAssertions;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features.GetTimeEntry;

namespace Pitbull.Tests.Unit.Handlers;

public class GetTimeEntryHandlerTests
{
    [Fact]
    public async Task Handle_ExistingTimeEntry_ReturnsTimeEntry()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var timeEntry = await CreateTimeEntry(db, employee, project, costCode);

        var handler = new GetTimeEntryHandler(db);
        var query = new GetTimeEntryQuery(timeEntry.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Id.Should().Be(timeEntry.Id);
        result.Value.Date.Should().Be(new DateOnly(2026, 2, 5));
        result.Value.RegularHours.Should().Be(8m);
        result.Value.OvertimeHours.Should().Be(2m);
        result.Value.TotalHours.Should().Be(10m);
    }

    [Fact]
    public async Task Handle_NonExistentTimeEntry_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new GetTimeEntryHandler(db);
        var query = new GetTimeEntryQuery(Guid.NewGuid());

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
        result.Error.Should().Contain("not found");
    }

    [Fact]
    public async Task Handle_IncludesEmployeeName()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var timeEntry = await CreateTimeEntry(db, employee, project, costCode);

        var handler = new GetTimeEntryHandler(db);
        var query = new GetTimeEntryQuery(timeEntry.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.EmployeeId.Should().Be(employee.Id);
        result.Value.EmployeeName.Should().Be("John Worker");
    }

    [Fact]
    public async Task Handle_IncludesProjectDetails()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var timeEntry = await CreateTimeEntry(db, employee, project, costCode);

        var handler = new GetTimeEntryHandler(db);
        var query = new GetTimeEntryQuery(timeEntry.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.ProjectId.Should().Be(project.Id);
        result.Value.ProjectName.Should().Be("Test Bridge Project");
        result.Value.ProjectNumber.Should().Be("PRJ-2026-001");
    }

    [Fact]
    public async Task Handle_IncludesCostCodeDetails()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var timeEntry = await CreateTimeEntry(db, employee, project, costCode);

        var handler = new GetTimeEntryHandler(db);
        var query = new GetTimeEntryQuery(timeEntry.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.CostCodeId.Should().Be(costCode.Id);
        result.Value.CostCodeDescription.Should().Be("General Labor");
    }

    [Fact]
    public async Task Handle_IncludesStatus()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var timeEntry = await CreateTimeEntry(db, employee, project, costCode, TimeEntryStatus.Approved);

        var handler = new GetTimeEntryHandler(db);
        var query = new GetTimeEntryQuery(timeEntry.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(TimeEntryStatus.Approved);
    }

    [Fact]
    public async Task Handle_DraftStatus_ReturnsCorrectStatus()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var timeEntry = await CreateTimeEntry(db, employee, project, costCode, TimeEntryStatus.Draft);

        var handler = new GetTimeEntryHandler(db);
        var query = new GetTimeEntryQuery(timeEntry.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(TimeEntryStatus.Draft);
    }

    [Fact]
    public async Task Handle_IncludesDescription()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var timeEntry = await CreateTimeEntry(db, employee, project, costCode);

        var handler = new GetTimeEntryHandler(db);
        var query = new GetTimeEntryQuery(timeEntry.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Description.Should().Be("Foundation work");
    }

    [Fact]
    public async Task Handle_IncludesAllHourTypes()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);

        var timeEntry = new TimeEntry
        {
            Date = new DateOnly(2026, 2, 5),
            EmployeeId = employee.Id,
            Employee = employee,
            ProjectId = project.Id,
            Project = project,
            CostCodeId = costCode.Id,
            CostCode = costCode,
            RegularHours = 8m,
            OvertimeHours = 4m,
            DoubletimeHours = 2m,
            Status = TimeEntryStatus.Submitted,
            Description = "Saturday work"
        };
        db.Set<TimeEntry>().Add(timeEntry);
        await db.SaveChangesAsync();

        var handler = new GetTimeEntryHandler(db);
        var query = new GetTimeEntryQuery(timeEntry.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.RegularHours.Should().Be(8m);
        result.Value.OvertimeHours.Should().Be(4m);
        result.Value.DoubletimeHours.Should().Be(2m);
        result.Value.TotalHours.Should().Be(14m);
    }

    #region Helper Methods

    private static async Task<(Employee, Project, CostCode)> SetupTestData(
        Pitbull.Core.Data.PitbullDbContext db)
    {
        var employee = new Employee
        {
            EmployeeNumber = "E001",
            FirstName = "John",
            LastName = "Worker",
            IsActive = true,
            Classification = EmployeeClassification.Hourly,
            BaseHourlyRate = 35m
        };
        db.Set<Employee>().Add(employee);

        var project = new Project
        {
            Name = "Test Bridge Project",
            Number = "PRJ-2026-001",
            Status = ProjectStatus.Active
        };
        db.Set<Project>().Add(project);

        var costCode = new CostCode
        {
            Code = "01-100",
            Description = "General Labor",
            IsActive = true
        };
        db.Set<CostCode>().Add(costCode);

        var assignment = new ProjectAssignment
        {
            EmployeeId = employee.Id,
            ProjectId = project.Id,
            Role = AssignmentRole.Worker,
            StartDate = new DateOnly(2026, 1, 1),
            IsActive = true
        };
        db.Set<ProjectAssignment>().Add(assignment);

        await db.SaveChangesAsync();
        return (employee, project, costCode);
    }

    private static async Task<TimeEntry> CreateTimeEntry(
        Pitbull.Core.Data.PitbullDbContext db,
        Employee employee,
        Project project,
        CostCode costCode,
        TimeEntryStatus status = TimeEntryStatus.Submitted)
    {
        var timeEntry = new TimeEntry
        {
            Date = new DateOnly(2026, 2, 5),
            EmployeeId = employee.Id,
            Employee = employee,
            ProjectId = project.Id,
            Project = project,
            CostCodeId = costCode.Id,
            CostCode = costCode,
            RegularHours = 8m,
            OvertimeHours = 2m,
            DoubletimeHours = 0m,
            Status = status,
            Description = "Foundation work"
        };

        db.Set<TimeEntry>().Add(timeEntry);
        await db.SaveChangesAsync();
        return timeEntry;
    }

    #endregion
}
