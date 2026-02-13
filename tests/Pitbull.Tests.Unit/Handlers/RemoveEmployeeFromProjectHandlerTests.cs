using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Projects.Domain;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features.RemoveEmployeeFromProject;

namespace Pitbull.Tests.Unit.Handlers;

public class RemoveEmployeeFromProjectHandlerTests
{
    [Fact]
    public async Task Handle_ValidAssignmentId_DeactivatesAssignment()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var assignment = await SetupTestData(db);
        var handler = new RemoveEmployeeFromProjectHandler(db);

        var command = new RemoveEmployeeFromProjectCommand(
            AssignmentId: assignment.Id
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();

        var updated = await db.Set<ProjectAssignment>()
            .IgnoreQueryFilters()
            .FirstAsync(a => a.Id == assignment.Id);
        updated.IsActive.Should().BeFalse();
        updated.EndDate.Should().NotBeNull();
    }

    [Fact]
    public async Task Handle_WithEndDate_SetsSpecifiedEndDate()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var assignment = await SetupTestData(db);
        var handler = new RemoveEmployeeFromProjectHandler(db);

        var endDate = new DateOnly(2026, 6, 30);
        var command = new RemoveEmployeeFromProjectCommand(
            AssignmentId: assignment.Id,
            EndDate: endDate
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();

        var updated = await db.Set<ProjectAssignment>()
            .IgnoreQueryFilters()
            .FirstAsync(a => a.Id == assignment.Id);
        updated.EndDate.Should().Be(endDate);
    }

    [Fact]
    public async Task Handle_AssignmentNotFound_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        await SetupTestData(db);
        var handler = new RemoveEmployeeFromProjectHandler(db);

        var command = new RemoveEmployeeFromProjectCommand(
            AssignmentId: Guid.NewGuid()
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("ASSIGNMENT_NOT_FOUND");
    }

    [Fact]
    public async Task Handle_AlreadyInactive_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var assignment = await SetupTestData(db);

        // Deactivate the assignment
        assignment.IsActive = false;
        await db.SaveChangesAsync();

        var handler = new RemoveEmployeeFromProjectHandler(db);

        var command = new RemoveEmployeeFromProjectCommand(
            AssignmentId: assignment.Id
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("ASSIGNMENT_NOT_FOUND");
    }

    [Fact]
    public async Task HandleByIds_ValidIds_DeactivatesAssignment()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var assignment = await SetupTestData(db);
        var handler = new RemoveEmployeeFromProjectByIdsHandler(db);

        var command = new RemoveEmployeeFromProjectByIdsCommand(
            EmployeeId: assignment.EmployeeId,
            ProjectId: assignment.ProjectId
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();

        var updated = await db.Set<ProjectAssignment>()
            .IgnoreQueryFilters()
            .FirstAsync(a => a.Id == assignment.Id);
        updated.IsActive.Should().BeFalse();
    }

    [Fact]
    public async Task HandleByIds_NoActiveAssignment_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        await SetupTestData(db);
        var handler = new RemoveEmployeeFromProjectByIdsHandler(db);

        var command = new RemoveEmployeeFromProjectByIdsCommand(
            EmployeeId: Guid.NewGuid(),
            ProjectId: Guid.NewGuid()
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("ASSIGNMENT_NOT_FOUND");
    }

    private static async Task<ProjectAssignment> SetupTestData(
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
        return assignment;
    }
}
