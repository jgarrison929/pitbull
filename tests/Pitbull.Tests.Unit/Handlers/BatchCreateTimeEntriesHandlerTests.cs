using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features.BatchCreateTimeEntries;
using Pitbull.TimeTracking.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class BatchCreateTimeEntriesHandlerTests
{
    private static IPayPeriodService CreateMockPayPeriodService()
    {
        var mock = new Mock<IPayPeriodService>();
        // By default, allow all time entries (no locked periods)
        mock.Setup(s => s.ValidateTimeEntryDateAsync(It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((string?)null);
        return mock.Object;
    }
    [Fact]
    public async Task Handle_ValidBatch_CreatesAllEntries()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employees, project, costCode) = await SetupTestData(db, 3);
        var handler = new BatchCreateTimeEntriesHandler(db, CreateMockPayPeriodService());
        
        var entries = employees.Select(e => new BatchTimeEntryItem(
            Date: new DateOnly(2026, 2, 5),
            EmployeeId: e.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 8m,
            OvertimeHours: 0m,
            DoubletimeHours: 0m
        )).ToList();

        var command = new BatchCreateTimeEntriesCommand(entries, AllowPartialSuccess: false);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.TotalSubmitted.Should().Be(3);
        result.Value.SuccessCount.Should().Be(3);
        result.Value.FailureCount.Should().Be(0);
        result.Value.Results.All(r => r.Success).Should().BeTrue();
    }

    [Fact]
    public async Task Handle_InvalidEntry_RollsBackAll_WhenPartialSuccessNotAllowed()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employees, project, costCode) = await SetupTestData(db, 2);
        var handler = new BatchCreateTimeEntriesHandler(db, CreateMockPayPeriodService());
        
        var entries = new List<BatchTimeEntryItem>
        {
            new(
                Date: new DateOnly(2026, 2, 5),
                EmployeeId: employees[0].Id,
                ProjectId: project.Id,
                CostCodeId: costCode.Id,
                RegularHours: 8m
            ),
            new(
                Date: new DateOnly(2026, 2, 5),
                EmployeeId: Guid.NewGuid(), // Non-existent employee
                ProjectId: project.Id,
                CostCodeId: costCode.Id,
                RegularHours: 8m
            )
        };

        var command = new BatchCreateTimeEntriesCommand(entries, AllowPartialSuccess: false);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.SuccessCount.Should().Be(0); // All rolled back
        result.Value.FailureCount.Should().Be(1); // Original failure count (1 invalid employee)
        result.Value.Results.All(r => !r.Success).Should().BeTrue(); // But all marked as failed
        
        // Verify nothing was saved
        var savedEntries = await db.Set<TimeEntry>().ToListAsync();
        savedEntries.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_InvalidEntry_CommitsValid_WhenPartialSuccessAllowed()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employees, project, costCode) = await SetupTestData(db, 2);
        var handler = new BatchCreateTimeEntriesHandler(db, CreateMockPayPeriodService());
        
        var entries = new List<BatchTimeEntryItem>
        {
            new(
                Date: new DateOnly(2026, 2, 5),
                EmployeeId: employees[0].Id,
                ProjectId: project.Id,
                CostCodeId: costCode.Id,
                RegularHours: 8m
            ),
            new(
                Date: new DateOnly(2026, 2, 5),
                EmployeeId: Guid.NewGuid(), // Non-existent employee
                ProjectId: project.Id,
                CostCodeId: costCode.Id,
                RegularHours: 8m
            )
        };

        var command = new BatchCreateTimeEntriesCommand(entries, AllowPartialSuccess: true);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.SuccessCount.Should().Be(1);
        result.Value.FailureCount.Should().Be(1);
        
        // Verify only valid entry was saved
        var savedEntries = await db.Set<TimeEntry>().ToListAsync();
        savedEntries.Should().HaveCount(1);
        savedEntries[0].EmployeeId.Should().Be(employees[0].Id);
    }

    [Fact]
    public async Task Handle_DuplicatesInBatch_RejectsSecondEntry()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employees, project, costCode) = await SetupTestData(db, 1);
        var handler = new BatchCreateTimeEntriesHandler(db, CreateMockPayPeriodService());
        
        var entries = new List<BatchTimeEntryItem>
        {
            new(
                Date: new DateOnly(2026, 2, 5),
                EmployeeId: employees[0].Id,
                ProjectId: project.Id,
                CostCodeId: costCode.Id,
                RegularHours: 8m
            ),
            new(
                Date: new DateOnly(2026, 2, 5),
                EmployeeId: employees[0].Id, // Same employee, same date - duplicate
                ProjectId: project.Id,
                CostCodeId: costCode.Id,
                RegularHours: 4m
            )
        };

        var command = new BatchCreateTimeEntriesCommand(entries, AllowPartialSuccess: true);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.SuccessCount.Should().Be(1);
        result.Value.FailureCount.Should().Be(1);
        result.Value.Results[1].ErrorCode.Should().Be("DUPLICATE_IN_BATCH");
    }

    [Fact]
    public async Task Handle_EmployeeNotAssignedToProject_ReturnsError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employees, project, costCode) = await SetupTestDataWithoutAssignments(db, 2);
        var handler = new BatchCreateTimeEntriesHandler(db, CreateMockPayPeriodService());
        
        var entries = employees.Select(e => new BatchTimeEntryItem(
            Date: new DateOnly(2026, 2, 5),
            EmployeeId: e.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 8m
        )).ToList();

        var command = new BatchCreateTimeEntriesCommand(entries, AllowPartialSuccess: true);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.FailureCount.Should().Be(2);
        result.Value.Results.All(r => r.ErrorCode == "NOT_ASSIGNED_TO_PROJECT").Should().BeTrue();
    }

    [Fact]
    public async Task Handle_InactiveEmployee_ReturnsError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employees, project, costCode) = await SetupTestData(db, 1);
        
        // Add inactive employee
        var inactiveEmployee = new Employee
        {
            EmployeeNumber = "E999",
            FirstName = "Inactive",
            LastName = "Worker",
            IsActive = false
        };
        db.Set<Employee>().Add(inactiveEmployee);
        await db.SaveChangesAsync();
        
        var handler = new BatchCreateTimeEntriesHandler(db, CreateMockPayPeriodService());
        
        var entries = new List<BatchTimeEntryItem>
        {
            new(
                Date: new DateOnly(2026, 2, 5),
                EmployeeId: inactiveEmployee.Id,
                ProjectId: project.Id,
                CostCodeId: costCode.Id,
                RegularHours: 8m
            )
        };

        var command = new BatchCreateTimeEntriesCommand(entries, AllowPartialSuccess: true);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.FailureCount.Should().Be(1);
        result.Value.Results[0].ErrorCode.Should().Be("EMPLOYEE_NOT_FOUND");
    }

    [Fact]
    public async Task Handle_ClosedProject_ReturnsError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employees, _, costCode) = await SetupTestData(db, 1);
        
        // Create closed project
        var closedProject = new Project
        {
            Name = "Closed Project",
            Number = "PRJ-CLOSED",
            Status = ProjectStatus.Closed
        };
        db.Set<Project>().Add(closedProject);
        await db.SaveChangesAsync();
        
        var handler = new BatchCreateTimeEntriesHandler(db, CreateMockPayPeriodService());
        
        var entries = new List<BatchTimeEntryItem>
        {
            new(
                Date: new DateOnly(2026, 2, 5),
                EmployeeId: employees[0].Id,
                ProjectId: closedProject.Id,
                CostCodeId: costCode.Id,
                RegularHours: 8m
            )
        };

        var command = new BatchCreateTimeEntriesCommand(entries, AllowPartialSuccess: true);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.FailureCount.Should().Be(1);
        result.Value.Results[0].ErrorCode.Should().Be("PROJECT_INACTIVE");
    }

    [Fact]
    public async Task Handle_ReturnsCorrectEmployeeNamesInResults()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employees, project, costCode) = await SetupTestData(db, 2);
        var handler = new BatchCreateTimeEntriesHandler(db, CreateMockPayPeriodService());
        
        var entries = employees.Select(e => new BatchTimeEntryItem(
            Date: new DateOnly(2026, 2, 5),
            EmployeeId: e.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 8m
        )).ToList();

        var command = new BatchCreateTimeEntriesCommand(entries, AllowPartialSuccess: false);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Value!.Results.Should().HaveCount(2);
        result.Value.Results.Select(r => r.EmployeeName).Should().Contain("John Worker1");
        result.Value.Results.Select(r => r.EmployeeName).Should().Contain("John Worker2");
    }

    [Fact]
    public async Task Handle_VariedHourTypes_CreatesEntriesCorrectly()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employees, project, costCode) = await SetupTestData(db, 1);
        var handler = new BatchCreateTimeEntriesHandler(db, CreateMockPayPeriodService());
        
        var entries = new List<BatchTimeEntryItem>
        {
            new(
                Date: new DateOnly(2026, 2, 5),
                EmployeeId: employees[0].Id,
                ProjectId: project.Id,
                CostCodeId: costCode.Id,
                RegularHours: 8m,
                OvertimeHours: 2m,
                DoubletimeHours: 1m,
                Description: "Long day"
            )
        };

        var command = new BatchCreateTimeEntriesCommand(entries, AllowPartialSuccess: false);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        
        var savedEntry = await db.Set<TimeEntry>().FirstAsync();
        savedEntry.RegularHours.Should().Be(8m);
        savedEntry.OvertimeHours.Should().Be(2m);
        savedEntry.DoubletimeHours.Should().Be(1m);
        savedEntry.TotalHours.Should().Be(11m);
        savedEntry.Description.Should().Be("Long day");
    }

    private static async Task<(List<Employee>, Project, CostCode)> SetupTestData(
        Pitbull.Core.Data.PitbullDbContext db, int employeeCount)
    {
        var employees = new List<Employee>();
        for (int i = 1; i <= employeeCount; i++)
        {
            var employee = new Employee
            {
                EmployeeNumber = $"E00{i}",
                FirstName = "John",
                LastName = $"Worker{i}",
                IsActive = true,
                Classification = EmployeeClassification.Hourly,
                BaseHourlyRate = 35m
            };
            employees.Add(employee);
            db.Set<Employee>().Add(employee);
        }

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

        await db.SaveChangesAsync();

        // Create assignments for all employees
        foreach (var employee in employees)
        {
            var assignment = new ProjectAssignment
            {
                EmployeeId = employee.Id,
                ProjectId = project.Id,
                Role = AssignmentRole.Worker,
                StartDate = new DateOnly(2026, 1, 1),
                IsActive = true
            };
            db.Set<ProjectAssignment>().Add(assignment);
        }

        await db.SaveChangesAsync();
        return (employees, project, costCode);
    }

    private static async Task<(List<Employee>, Project, CostCode)> SetupTestDataWithoutAssignments(
        Pitbull.Core.Data.PitbullDbContext db, int employeeCount)
    {
        var employees = new List<Employee>();
        for (int i = 1; i <= employeeCount; i++)
        {
            var employee = new Employee
            {
                EmployeeNumber = $"E00{i}",
                FirstName = "John",
                LastName = $"Worker{i}",
                IsActive = true,
                Classification = EmployeeClassification.Hourly,
                BaseHourlyRate = 35m
            };
            employees.Add(employee);
            db.Set<Employee>().Add(employee);
        }

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

        await db.SaveChangesAsync();
        return (employees, project, costCode);
    }
}
