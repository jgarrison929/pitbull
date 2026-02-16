using FluentAssertions;
using FluentValidation;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features.BatchCreateTimeEntries;
using Pitbull.TimeTracking.Features.BulkSubmitTimeEntries;
using Pitbull.TimeTracking.Features.CreateTimeEntry;
using Pitbull.TimeTracking.Features.UpdateTimeEntry;
using Pitbull.TimeTracking.Services;

namespace Pitbull.Tests.Unit.Services;

public sealed class TimeEntryBulkSubmitTests
{
    [Fact]
    public async Task BulkSubmit_DraftEntries_TransitionsToSubmitted()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (_, project, costCode) = await SetupTestData(db);
        var employee = db.Set<Employee>().First();
        var service = CreateService(db);

        var entry = new TimeEntry
        {
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId = employee.Id,
            ProjectId = project.Id,
            CostCodeId = costCode.Id,
            RegularHours = 8m,
            Status = TimeEntryStatus.Draft
        };
        db.Set<TimeEntry>().Add(entry);
        await db.SaveChangesAsync();

        var submitterId = Guid.NewGuid();
        var command = new BulkSubmitTimeEntriesCommand([entry.Id], submitterId);

        // Act
        var result = await service.BulkSubmitTimeEntriesAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.SuccessCount.Should().Be(1);

        var updated = db.Set<TimeEntry>().First(te => te.Id == entry.Id);
        updated.Status.Should().Be(TimeEntryStatus.Submitted);
    }

    [Fact]
    public async Task BulkSubmit_NonDraftEntry_ReturnsError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (_, project, costCode) = await SetupTestData(db);
        var employee = db.Set<Employee>().First();
        var service = CreateService(db);

        var entry = new TimeEntry
        {
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId = employee.Id,
            ProjectId = project.Id,
            CostCodeId = costCode.Id,
            RegularHours = 8m,
            Status = TimeEntryStatus.Submitted // already submitted
        };
        db.Set<TimeEntry>().Add(entry);
        await db.SaveChangesAsync();

        var command = new BulkSubmitTimeEntriesCommand([entry.Id], Guid.NewGuid());

        // Act
        var result = await service.BulkSubmitTimeEntriesAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.FailureCount.Should().Be(1);
        result.Value.Results[0].ErrorCode.Should().Be("INVALID_TRANSITION");
    }

    [Fact]
    public async Task BulkSubmit_NonExistentEntry_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        await SetupTestData(db);
        var service = CreateService(db);

        var command = new BulkSubmitTimeEntriesCommand([Guid.NewGuid()], Guid.NewGuid());

        // Act
        var result = await service.BulkSubmitTimeEntriesAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.FailureCount.Should().Be(1);
        result.Value.Results[0].ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task BulkSubmit_SetsSubmittedAtAndSubmittedById()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (_, project, costCode) = await SetupTestData(db);
        var employee = db.Set<Employee>().First();
        var service = CreateService(db);
        var submitterId = Guid.NewGuid();
        var beforeSubmit = DateTime.UtcNow;

        var entry = new TimeEntry
        {
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId = employee.Id,
            ProjectId = project.Id,
            CostCodeId = costCode.Id,
            RegularHours = 8m,
            Status = TimeEntryStatus.Draft
        };
        db.Set<TimeEntry>().Add(entry);
        await db.SaveChangesAsync();

        var command = new BulkSubmitTimeEntriesCommand([entry.Id], submitterId);

        // Act
        var result = await service.BulkSubmitTimeEntriesAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();

        var updated = db.Set<TimeEntry>().First(te => te.Id == entry.Id);
        updated.SubmittedById.Should().Be(submitterId);
        updated.SubmittedAt.Should().NotBeNull();
        updated.SubmittedAt!.Value.Should().BeOnOrAfter(beforeSubmit);
    }

    [Fact]
    public async Task BulkSubmit_SoftDeletedEntry_ReturnsError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (_, project, costCode) = await SetupTestData(db);
        var employee = db.Set<Employee>().First();
        var service = CreateService(db);

        var entry = new TimeEntry
        {
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId = employee.Id,
            ProjectId = project.Id,
            CostCodeId = costCode.Id,
            RegularHours = 8m,
            Status = TimeEntryStatus.Draft,
            IsDeleted = true
        };
        db.Set<TimeEntry>().Add(entry);
        await db.SaveChangesAsync();

        var command = new BulkSubmitTimeEntriesCommand([entry.Id], Guid.NewGuid());

        // Act
        var result = await service.BulkSubmitTimeEntriesAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.FailureCount.Should().Be(1);
        result.Value.Results[0].ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task BulkSubmit_ExceedsMaxCount_ReturnsError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        await SetupTestData(db);
        var service = CreateService(db);

        var ids = Enumerable.Range(0, 501).Select(_ => Guid.NewGuid()).ToList();
        var command = new BulkSubmitTimeEntriesCommand(ids, Guid.NewGuid());

        // Act
        var result = await service.BulkSubmitTimeEntriesAsync(command);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task BulkSubmit_ClosedProject_RejectsAtSubmitTime()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (_, project, costCode) = await SetupTestData(db);
        var employee = db.Set<Employee>().First();
        var service = CreateService(db);

        // Create a draft entry
        var entry = new TimeEntry
        {
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId = employee.Id,
            ProjectId = project.Id,
            CostCodeId = costCode.Id,
            RegularHours = 8m,
            Status = TimeEntryStatus.Draft
        };
        db.Set<TimeEntry>().Add(entry);
        await db.SaveChangesAsync();

        // Now close the project
        project.Status = ProjectStatus.Closed;
        await db.SaveChangesAsync();

        var command = new BulkSubmitTimeEntriesCommand([entry.Id], Guid.NewGuid());

        // Act
        var result = await service.BulkSubmitTimeEntriesAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.FailureCount.Should().Be(1);
        result.Value.Results[0].ErrorCode.Should().Be("PROJECT_INACTIVE");
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
            NullLogger<TimeEntryService>.Instance
        );
    }

    private static async Task<(Employee employee, Project project, CostCode costCode)> SetupTestData(
        Pitbull.Core.Data.PitbullDbContext db)
    {
        var employee = new Employee
        {
            FirstName = "Jane",
            LastName = "Foreman",
            EmployeeNumber = "EMP002",
            Email = "jane@test.com",
            IsActive = true,
            Classification = EmployeeClassification.Hourly,
            BaseHourlyRate = 40m
        };
        db.Set<Employee>().Add(employee);

        var project = new Project
        {
            Name = "Bridge Reconstruction",
            Number = "P-200",
            Status = ProjectStatus.Active
        };
        db.Set<Project>().Add(project);

        var costCode = new CostCode
        {
            Code = "03-100",
            Description = "Concrete Work",
            IsActive = true,
            CostType = CostType.Labor
        };
        db.Set<CostCode>().Add(costCode);

        var assignment = new ProjectAssignment
        {
            EmployeeId = employee.Id,
            ProjectId = project.Id,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30)),
            IsActive = true,
            Role = AssignmentRole.Worker
        };
        db.Set<ProjectAssignment>().Add(assignment);

        await db.SaveChangesAsync();
        return (employee, project, costCode);
    }

    #endregion
}
