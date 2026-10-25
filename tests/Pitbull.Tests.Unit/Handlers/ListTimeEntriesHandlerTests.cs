using FluentAssertions;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features.ListTimeEntries;

namespace Pitbull.Tests.Unit.Handlers;

public class ListTimeEntriesHandlerTests
{
    [Fact]
    public async Task Handle_NoFilters_ReturnsAllTimeEntries()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        await CreateTimeEntries(db, employee, project, costCode, 5);

        var handler = new ListTimeEntriesHandler(db);
        var query = new ListTimeEntriesQuery();

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(5);
        result.Value.TotalCount.Should().Be(5);
    }

    [Fact]
    public async Task Handle_FilterByProjectId_ReturnsMatchingEntries()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project1, costCode) = await SetupTestData(db);

        // Create second project
        var project2 = new Project
        {
            Name = "Another Project",
            Number = "PRJ-002",
            Status = ProjectStatus.Active
        };
        db.Set<Project>().Add(project2);
        await db.SaveChangesAsync();

        // Create entries for both projects
        await CreateTimeEntries(db, employee, project1, costCode, 3);
        await CreateTimeEntries(db, employee, project2, costCode, 2, startDayOffset: 10);

        var handler = new ListTimeEntriesHandler(db);
        var query = new ListTimeEntriesQuery(ProjectId: project1.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(3);
        result.Value.Items.Should().OnlyContain(e => e.ProjectId == project1.Id);
    }

    [Fact]
    public async Task Handle_FilterByEmployeeId_ReturnsMatchingEntries()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee1, project, costCode) = await SetupTestData(db);

        // Create second employee
        var employee2 = new Employee
        {
            EmployeeNumber = "E002",
            FirstName = "Jane",
            LastName = "Worker",
            IsActive = true,
            Classification = EmployeeClassification.Hourly,
            BaseHourlyRate = 40m
        };
        db.Set<Employee>().Add(employee2);

        // Add assignment for employee2
        var assignment = new ProjectAssignment
        {
            EmployeeId = employee2.Id,
            ProjectId = project.Id,
            Role = AssignmentRole.Worker,
            StartDate = new DateOnly(2026, 1, 1),
            IsActive = true
        };
        db.Set<ProjectAssignment>().Add(assignment);
        await db.SaveChangesAsync();

        // Create entries for both employees
        await CreateTimeEntries(db, employee1, project, costCode, 3);
        await CreateTimeEntries(db, employee2, project, costCode, 2, startDayOffset: 10);

        var handler = new ListTimeEntriesHandler(db);
        var query = new ListTimeEntriesQuery(EmployeeId: employee1.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(3);
        result.Value.Items.Should().OnlyContain(e => e.EmployeeId == employee1.Id);
    }

    [Fact]
    public async Task Handle_FilterByStatus_ReturnsMatchingEntries()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);

        // Create entries with different statuses
        var entries = new[]
        {
            CreateTimeEntry(employee, project, costCode, new DateOnly(2026, 2, 1), TimeEntryStatus.Submitted),
            CreateTimeEntry(employee, project, costCode, new DateOnly(2026, 2, 2), TimeEntryStatus.Submitted),
            CreateTimeEntry(employee, project, costCode, new DateOnly(2026, 2, 3), TimeEntryStatus.Approved),
            CreateTimeEntry(employee, project, costCode, new DateOnly(2026, 2, 4), TimeEntryStatus.Rejected),
            CreateTimeEntry(employee, project, costCode, new DateOnly(2026, 2, 5), TimeEntryStatus.Draft)
        };
        db.Set<TimeEntry>().AddRange(entries);
        await db.SaveChangesAsync();

        var handler = new ListTimeEntriesHandler(db);
        var query = new ListTimeEntriesQuery(Status: TimeEntryStatus.Submitted);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(2);
        result.Value.Items.Should().OnlyContain(e => e.Status == TimeEntryStatus.Submitted);
    }

    [Fact]
    public async Task Handle_FilterByDateRange_ReturnsMatchingEntries()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);

        // Create entries across date range
        var entries = new[]
        {
            CreateTimeEntry(employee, project, costCode, new DateOnly(2026, 1, 15)),
            CreateTimeEntry(employee, project, costCode, new DateOnly(2026, 2, 1)),
            CreateTimeEntry(employee, project, costCode, new DateOnly(2026, 2, 5)),
            CreateTimeEntry(employee, project, costCode, new DateOnly(2026, 2, 10)),
            CreateTimeEntry(employee, project, costCode, new DateOnly(2026, 3, 1))
        };
        db.Set<TimeEntry>().AddRange(entries);
        await db.SaveChangesAsync();

        var handler = new ListTimeEntriesHandler(db);
        var query = new ListTimeEntriesQuery(
            StartDate: new DateOnly(2026, 2, 1),
            EndDate: new DateOnly(2026, 2, 10));

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(3);
        result.Value.Items.Should().OnlyContain(e =>
            e.Date >= new DateOnly(2026, 2, 1) && e.Date <= new DateOnly(2026, 2, 10));
    }

    [Fact]
    public async Task Handle_FilterByStartDateOnly_ReturnsEntriesFromThatDate()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);

        var entries = new[]
        {
            CreateTimeEntry(employee, project, costCode, new DateOnly(2026, 1, 15)),
            CreateTimeEntry(employee, project, costCode, new DateOnly(2026, 2, 1)),
            CreateTimeEntry(employee, project, costCode, new DateOnly(2026, 2, 15))
        };
        db.Set<TimeEntry>().AddRange(entries);
        await db.SaveChangesAsync();

        var handler = new ListTimeEntriesHandler(db);
        var query = new ListTimeEntriesQuery(StartDate: new DateOnly(2026, 2, 1));

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(2);
        result.Value.Items.Should().OnlyContain(e => e.Date >= new DateOnly(2026, 2, 1));
    }

    [Fact]
    public async Task Handle_FilterByEndDateOnly_ReturnsEntriesUpToThatDate()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);

        var entries = new[]
        {
            CreateTimeEntry(employee, project, costCode, new DateOnly(2026, 1, 15)),
            CreateTimeEntry(employee, project, costCode, new DateOnly(2026, 2, 1)),
            CreateTimeEntry(employee, project, costCode, new DateOnly(2026, 2, 15))
        };
        db.Set<TimeEntry>().AddRange(entries);
        await db.SaveChangesAsync();

        var handler = new ListTimeEntriesHandler(db);
        var query = new ListTimeEntriesQuery(EndDate: new DateOnly(2026, 2, 1));

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(2);
        result.Value.Items.Should().OnlyContain(e => e.Date <= new DateOnly(2026, 2, 1));
    }

    [Fact]
    public async Task Handle_CombinedFilters_ReturnsFilteredResults()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);

        var entries = new[]
        {
            CreateTimeEntry(employee, project, costCode, new DateOnly(2026, 2, 1), TimeEntryStatus.Approved),
            CreateTimeEntry(employee, project, costCode, new DateOnly(2026, 2, 2), TimeEntryStatus.Submitted),
            CreateTimeEntry(employee, project, costCode, new DateOnly(2026, 2, 3), TimeEntryStatus.Approved),
            CreateTimeEntry(employee, project, costCode, new DateOnly(2026, 2, 10), TimeEntryStatus.Approved)
        };
        db.Set<TimeEntry>().AddRange(entries);
        await db.SaveChangesAsync();

        var handler = new ListTimeEntriesHandler(db);
        var query = new ListTimeEntriesQuery(
            ProjectId: project.Id,
            Status: TimeEntryStatus.Approved,
            StartDate: new DateOnly(2026, 2, 1),
            EndDate: new DateOnly(2026, 2, 5));

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(2); // Only approved entries in date range
    }

    [Fact]
    public async Task Handle_Pagination_ReturnsCorrectPage()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        await CreateTimeEntries(db, employee, project, costCode, 10);

        var handler = new ListTimeEntriesHandler(db);
        var query = new ListTimeEntriesQuery { Page = 1, PageSize = 3 };

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(3);
        result.Value.TotalCount.Should().Be(10);
        result.Value.Page.Should().Be(1);
        result.Value.PageSize.Should().Be(3);
        result.Value.TotalPages.Should().Be(4);
    }

    [Fact]
    public async Task Handle_SecondPage_ReturnsCorrectItems()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        await CreateTimeEntries(db, employee, project, costCode, 10);

        var handler = new ListTimeEntriesHandler(db);
        var query = new ListTimeEntriesQuery { Page = 2, PageSize = 3 };

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(3);
        result.Value.Page.Should().Be(2);
    }

    [Fact]
    public async Task Handle_OrdersByDateDescending()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);

        var entries = new[]
        {
            CreateTimeEntry(employee, project, costCode, new DateOnly(2026, 2, 1)),
            CreateTimeEntry(employee, project, costCode, new DateOnly(2026, 2, 10)),
            CreateTimeEntry(employee, project, costCode, new DateOnly(2026, 2, 5))
        };
        db.Set<TimeEntry>().AddRange(entries);
        await db.SaveChangesAsync();

        var handler = new ListTimeEntriesHandler(db);
        var query = new ListTimeEntriesQuery();

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var dates = result.Value!.Items.Select(e => e.Date).ToList();
        dates.Should().BeInDescendingOrder();
    }

    [Fact]
    public async Task Handle_EmptyDatabase_ReturnsEmptyList()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new ListTimeEntriesHandler(db);
        var query = new ListTimeEntriesQuery();

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().BeEmpty();
        result.Value.TotalCount.Should().Be(0);
        result.Value.TotalPages.Should().Be(0);
    }

    [Fact]
    public async Task Handle_NoMatchingResults_ReturnsEmptyList()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        await CreateTimeEntries(db, employee, project, costCode, 3);

        var handler = new ListTimeEntriesHandler(db);
        var query = new ListTimeEntriesQuery(ProjectId: Guid.NewGuid()); // Non-existent project

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().BeEmpty();
        result.Value.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task Handle_IncludesEmployeeName()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        await CreateTimeEntries(db, employee, project, costCode, 1);

        var handler = new ListTimeEntriesHandler(db);
        var query = new ListTimeEntriesQuery();

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items[0].EmployeeName.Should().Be("John Worker");
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

    private static async Task CreateTimeEntries(
        Pitbull.Core.Data.PitbullDbContext db,
        Employee employee,
        Project project,
        CostCode costCode,
        int count,
        int startDayOffset = 0)
    {
        var entries = Enumerable.Range(0, count)
            .Select(i => CreateTimeEntry(
                employee, project, costCode,
                new DateOnly(2026, 2, 1 + startDayOffset + i)))
            .ToList();

        db.Set<TimeEntry>().AddRange(entries);
        await db.SaveChangesAsync();
    }

    private static TimeEntry CreateTimeEntry(
        Employee employee,
        Project project,
        CostCode costCode,
        DateOnly date,
        TimeEntryStatus status = TimeEntryStatus.Submitted)
    {
        return new TimeEntry
        {
            Date = date,
            EmployeeId = employee.Id,
            Employee = employee,
            ProjectId = project.Id,
            Project = project,
            CostCodeId = costCode.Id,
            CostCode = costCode,
            RegularHours = 8m,
            OvertimeHours = 0m,
            DoubletimeHours = 0m,
            Status = status,
            Description = $"Work on {date:yyyy-MM-dd}"
        };
    }

    #endregion
}
