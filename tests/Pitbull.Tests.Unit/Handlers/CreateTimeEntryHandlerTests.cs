using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features.CreateTimeEntry;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class CreateTimeEntryHandlerTests
{
    [Fact]
    public async Task Handle_ValidCommand_CreatesTimeEntry()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var handler = new CreateTimeEntryHandler(db);

        var command = new CreateTimeEntryCommand(
            Date: new DateOnly(2026, 2, 5),
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 8m,
            OvertimeHours: 2m,
            DoubletimeHours: 0m,
            Description: "Foundation work"
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.RegularHours.Should().Be(8m);
        result.Value.OvertimeHours.Should().Be(2m);
        result.Value.TotalHours.Should().Be(10m);
        result.Value.Status.Should().Be(TimeEntryStatus.Submitted);
    }

    [Fact]
    public async Task Handle_EmployeeNotFound_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (_, project, costCode) = await SetupTestData(db);
        var handler = new CreateTimeEntryHandler(db);

        var command = new CreateTimeEntryCommand(
            Date: new DateOnly(2026, 2, 5),
            EmployeeId: Guid.NewGuid(), // Non-existent employee
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 8m
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("EMPLOYEE_NOT_FOUND");
    }

    [Fact]
    public async Task Handle_ProjectNotFound_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, _, costCode) = await SetupTestData(db);
        var handler = new CreateTimeEntryHandler(db);

        var command = new CreateTimeEntryCommand(
            Date: new DateOnly(2026, 2, 5),
            EmployeeId: employee.Id,
            ProjectId: Guid.NewGuid(), // Non-existent project
            CostCodeId: costCode.Id,
            RegularHours: 8m
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("PROJECT_NOT_FOUND");
    }

    [Fact]
    public async Task Handle_CostCodeNotFound_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, _) = await SetupTestData(db);
        var handler = new CreateTimeEntryHandler(db);

        var command = new CreateTimeEntryCommand(
            Date: new DateOnly(2026, 2, 5),
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            CostCodeId: Guid.NewGuid(), // Non-existent cost code
            RegularHours: 8m
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("COSTCODE_NOT_FOUND");
    }

    [Fact]
    public async Task Handle_ClosedProject_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, _, costCode) = await SetupTestData(db);

        // Create a closed project
        var closedProject = new Project
        {
            Name = "Closed Project",
            Number = "PRJ-CLOSED",
            Status = ProjectStatus.Closed
        };
        db.Set<Project>().Add(closedProject);
        await db.SaveChangesAsync();

        var handler = new CreateTimeEntryHandler(db);

        var command = new CreateTimeEntryCommand(
            Date: new DateOnly(2026, 2, 5),
            EmployeeId: employee.Id,
            ProjectId: closedProject.Id,
            CostCodeId: costCode.Id,
            RegularHours: 8m
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("PROJECT_INACTIVE");
    }

    [Fact]
    public async Task Handle_DuplicateEntry_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var handler = new CreateTimeEntryHandler(db);

        var command = new CreateTimeEntryCommand(
            Date: new DateOnly(2026, 2, 5),
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 8m
        );

        // Create first entry
        await handler.Handle(command, CancellationToken.None);

        // Act - try to create duplicate
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("DUPLICATE_ENTRY");
    }

    [Fact]
    public async Task Handle_InactiveEmployee_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (_, project, costCode) = await SetupTestData(db);

        // Create inactive employee
        var inactiveEmployee = new Employee
        {
            EmployeeNumber = "E999",
            FirstName = "Inactive",
            LastName = "Worker",
            IsActive = false
        };
        db.Set<Employee>().Add(inactiveEmployee);
        await db.SaveChangesAsync();

        var handler = new CreateTimeEntryHandler(db);

        var command = new CreateTimeEntryCommand(
            Date: new DateOnly(2026, 2, 5),
            EmployeeId: inactiveEmployee.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 8m
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("EMPLOYEE_NOT_FOUND");
    }

    [Fact]
    public async Task Handle_NotAssignedToProject_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestDataWithoutAssignment(db);
        var handler = new CreateTimeEntryHandler(db);

        var command = new CreateTimeEntryCommand(
            Date: new DateOnly(2026, 2, 5),
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 8m
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_ASSIGNED_TO_PROJECT");
    }

    [Fact]
    public async Task Handle_AssignmentExpired_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestDataWithoutAssignment(db);

        // Create expired assignment
        var assignment = new ProjectAssignment
        {
            EmployeeId = employee.Id,
            ProjectId = project.Id,
            Role = AssignmentRole.Worker,
            StartDate = new DateOnly(2026, 1, 1),
            EndDate = new DateOnly(2026, 1, 31), // Expired
            IsActive = true
        };
        db.Set<ProjectAssignment>().Add(assignment);
        await db.SaveChangesAsync();

        var handler = new CreateTimeEntryHandler(db);

        var command = new CreateTimeEntryCommand(
            Date: new DateOnly(2026, 2, 5), // After assignment ends
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 8m
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_ASSIGNED_TO_PROJECT");
    }

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

        // Create assignment so employee can log time
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

    private static async Task<(Employee, Project, CostCode)> SetupTestDataWithoutAssignment(
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

        await db.SaveChangesAsync();
        return (employee, project, costCode);
    }
}
