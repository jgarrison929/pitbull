using FluentAssertions;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features.BatchCreateTimeEntries;
using Pitbull.TimeTracking.Features.CreateTimeEntry;
using Pitbull.TimeTracking.Features.ReviewTimeEntries;
using Pitbull.TimeTracking.Features.UpdateTimeEntry;
using Pitbull.TimeTracking.Services;

namespace Pitbull.Tests.Unit.Services;

public sealed class TimeEntryReviewSecurityTests
{
    // Test for Requirement 1: Reviewer cannot approve their own time entries
    [Fact]
    public async Task ReviewTimeEntriesAsync_ReviewerCannotApproveOwnTime()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (manager, project, costCode) = await SetupTestData(db);
        var service = CreateService(db);

        // This time entry is for the manager themselves
        var selfTimeEntry = new TimeEntry
        {
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId = manager.Id, // Entry belongs to the manager
            ProjectId = project.Id,
            CostCodeId = costCode.Id,
            RegularHours = 8m,
            Status = TimeEntryStatus.Submitted
        };
        db.Set<TimeEntry>().Add(selfTimeEntry);
        await db.SaveChangesAsync();

        var decisions = new List<TimeEntryReviewDecision>
        {
            new(selfTimeEntry.Id, TimeEntryReviewDecisionType.Approve)
        };
        var command = new ReviewTimeEntriesCommand(decisions);

        // Act: Manager attempts to approve their own time entry
        var result = await service.ReviewTimeEntriesAsync(command, manager.Id);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Failed.Should().Be(1);
        result.Value.Results[0].Success.Should().BeFalse();
        result.Value.Results[0].ErrorCode.Should().Be("UNAUTHORIZED");
        result.Value.Results[0].Error.Should().Contain("User does not have permission to review this time entry");
    }

    // Test for Requirement 2: Reviewer can only review entries in their assigned projects
    [Fact]
    public async Task GetReviewQueueAsync_OnlyReturnsEntriesForAssignedProjects()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var manager = new Employee { Id = Guid.NewGuid(), FirstName = "Manager", LastName = "A", Email = "manager@test.com", IsActive = true, Classification = EmployeeClassification.Salaried };
        var projectA = new Project { Id = Guid.NewGuid(), Name = "Project A", Number = "P-A" };
        var projectB = new Project { Id = Guid.NewGuid(), Name = "Project B", Number = "P-B" };
        var worker = new Employee { Id = Guid.NewGuid(), FirstName = "Worker", LastName = "Bee", IsActive = true };
        var costCode = new CostCode { Id = Guid.NewGuid(), Code = "01-000", Description = "General", IsActive = true };
        
        // Manager is assigned only to Project A
        var assignment = new ProjectAssignment { EmployeeId = manager.Id, ProjectId = projectA.Id, IsActive = true, Role = AssignmentRole.Manager };
        
        db.AddRange(manager, projectA, projectB, worker, costCode, assignment);
        await db.SaveChangesAsync();

        // Entry for Project A (manager should see this)
        var entryA = new TimeEntry { Date = DateOnly.FromDateTime(DateTime.UtcNow), EmployeeId = worker.Id, ProjectId = projectA.Id, CostCodeId = costCode.Id, RegularHours = 8m, Status = TimeEntryStatus.Submitted };
        // Entry for Project B (manager should NOT see this)
        var entryB = new TimeEntry { Date = DateOnly.FromDateTime(DateTime.UtcNow), EmployeeId = worker.Id, ProjectId = projectB.Id, CostCodeId = costCode.Id, RegularHours = 8m, Status = TimeEntryStatus.Submitted };
        
        db.Set<TimeEntry>().AddRange(entryA, entryB);
        await db.SaveChangesAsync();

        // Act
        var result = await service.GetReviewQueueAsync(null, null, null, null, manager.Id);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalEntries.Should().Be(1);
        result.Value.Groups.Should().HaveCount(1);
        result.Value.Groups[0].ProjectId.Should().Be(projectA.Id);
        result.Value.Groups[0].Entries[0].Id.Should().Be(entryA.Id);
    }

    // Test for Requirement 3: JWT email resolution works
    [Fact]
    public async Task GetEmployeeByEmailAsync_ReturnsCorrectEmployee()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, _, _) = await SetupTestData(db);
        var service = CreateService(db);
        var nonExistentEmail = "nobody@home.com";

        // Act
        var foundEmployee = await service.GetEmployeeByEmailAsync(employee.Email!);
        var notFoundEmployee = await service.GetEmployeeByEmailAsync(nonExistentEmail);
        var inactiveEmployeeResult = await service.GetEmployeeByEmailAsync("inactive@test.com");

        // Assert
        foundEmployee.Should().NotBeNull();
        foundEmployee!.Id.Should().Be(employee.Id);
        
        notFoundEmployee.Should().BeNull();
        inactiveEmployeeResult.Should().BeNull();
    }

    #region Helper Methods

    private static TimeEntryService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        return new TimeEntryService(
            db,
            new CreateTimeEntryValidator(),
            new UpdateTimeEntryValidator(),
            new BatchCreateTimeEntriesValidator(),
            new LaborCostCalculator(),
            Mock.Of<IPayPeriodService>(),
            new GeofenceService(),
            NullLogger<TimeEntryService>.Instance
        );
    }

    private static async Task<(Employee employee, Project project, CostCode costCode)> SetupTestData(
        Pitbull.Core.Data.PitbullDbContext db)
    {
        var employee = new Employee
        {
            Id = Guid.NewGuid(),
            FirstName = "Test",
            LastName = "Manager",
            EmployeeNumber = "MANAGER-01",
            Email = "manager-01@test.com",
            IsActive = true,
            Classification = EmployeeClassification.Salaried // Approver
        };
        var inactiveEmployee = new Employee { Id = Guid.NewGuid(), Email = "inactive@test.com", IsActive = false };

        db.Set<Employee>().AddRange(employee, inactiveEmployee);

        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = "Test Project",
            Number = "P-100",
            Status = ProjectStatus.Active
        };
        db.Set<Project>().Add(project);

        var costCode = new CostCode
        {
            Id = Guid.NewGuid(),
            Code = "03-100",
            Description = "Concrete Work",
            IsActive = true,
            CostType = CostType.Labor
        };
        db.Set<CostCode>().Add(costCode);

        // Assign the manager to the project so they have approval rights
        var assignment = new ProjectAssignment
        {
            EmployeeId = employee.Id,
            ProjectId = project.Id,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30)),
            IsActive = true,
            Role = AssignmentRole.Manager
        };
        db.Set<ProjectAssignment>().Add(assignment);

        await db.SaveChangesAsync();
        return (employee, project, costCode);
    }

    #endregion
}
