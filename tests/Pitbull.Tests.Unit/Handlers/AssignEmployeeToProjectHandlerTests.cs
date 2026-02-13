using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features.AssignEmployeeToProject;

namespace Pitbull.Tests.Unit.Handlers;

public class AssignEmployeeToProjectHandlerTests
{
    [Fact]
    public async Task Handle_ValidCommand_CreatesAssignment()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project) = await SetupTestData(db);
        var handler = new AssignEmployeeToProjectHandler(db);

        var command = new AssignEmployeeToProjectCommand(
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            Role: AssignmentRole.Worker,
            StartDate: new DateOnly(2026, 2, 1),
            Notes: "Assigned to foundation work"
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.EmployeeId.Should().Be(employee.Id);
        result.Value.ProjectId.Should().Be(project.Id);
        result.Value.Role.Should().Be(AssignmentRole.Worker);
        result.Value.IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_WithManagerRole_SetsCorrectRole()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project) = await SetupTestData(db);
        var handler = new AssignEmployeeToProjectHandler(db);

        var command = new AssignEmployeeToProjectCommand(
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            Role: AssignmentRole.Manager
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Role.Should().Be(AssignmentRole.Manager);
        result.Value.RoleDescription.Should().Be("Manager");
    }

    [Fact]
    public async Task Handle_EmployeeNotFound_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (_, project) = await SetupTestData(db);
        var handler = new AssignEmployeeToProjectHandler(db);

        var command = new AssignEmployeeToProjectCommand(
            EmployeeId: Guid.NewGuid(),
            ProjectId: project.Id
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
        var (employee, _) = await SetupTestData(db);
        var handler = new AssignEmployeeToProjectHandler(db);

        var command = new AssignEmployeeToProjectCommand(
            EmployeeId: employee.Id,
            ProjectId: Guid.NewGuid()
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("PROJECT_NOT_FOUND");
    }

    [Fact]
    public async Task Handle_DuplicateAssignment_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project) = await SetupTestData(db);
        var handler = new AssignEmployeeToProjectHandler(db);

        var command = new AssignEmployeeToProjectCommand(
            EmployeeId: employee.Id,
            ProjectId: project.Id
        );

        // Create first assignment
        await handler.Handle(command, CancellationToken.None);

        // Act - try to create duplicate
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("DUPLICATE_ASSIGNMENT");
    }

    [Fact]
    public async Task Handle_InactiveEmployee_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (_, project) = await SetupTestData(db);

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

        var handler = new AssignEmployeeToProjectHandler(db);

        var command = new AssignEmployeeToProjectCommand(
            EmployeeId: inactiveEmployee.Id,
            ProjectId: project.Id
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("EMPLOYEE_NOT_FOUND");
    }

    [Fact]
    public async Task Handle_InvalidDateRange_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project) = await SetupTestData(db);
        var handler = new AssignEmployeeToProjectHandler(db);

        var command = new AssignEmployeeToProjectCommand(
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            StartDate: new DateOnly(2026, 3, 1),
            EndDate: new DateOnly(2026, 2, 1) // End before start
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_DATE_RANGE");
    }

    [Fact]
    public async Task Handle_WithEndDate_SetsEndDate()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project) = await SetupTestData(db);
        var handler = new AssignEmployeeToProjectHandler(db);

        var command = new AssignEmployeeToProjectCommand(
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            StartDate: new DateOnly(2026, 2, 1),
            EndDate: new DateOnly(2026, 6, 30)
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.StartDate.Should().Be(new DateOnly(2026, 2, 1));
        result.Value.EndDate.Should().Be(new DateOnly(2026, 6, 30));
    }

    private static async Task<(Employee, Project)> SetupTestData(
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

        await db.SaveChangesAsync();
        return (employee, project);
    }
}
