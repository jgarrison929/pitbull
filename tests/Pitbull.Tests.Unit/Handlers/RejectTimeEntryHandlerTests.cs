using FluentAssertions;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features.RejectTimeEntry;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class RejectTimeEntryHandlerTests
{
    [Fact]
    public async Task Handle_ValidSubmittedEntry_RejectsSuccessfully()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, reviewer, project, costCode) = await SetupTestData(db);
        var timeEntry = await CreateTimeEntry(db, employee, project, costCode, TimeEntryStatus.Submitted);

        var handler = new RejectTimeEntryHandler(db);
        var command = new RejectTimeEntryCommand(
            TimeEntryId: timeEntry.Id,
            RejectedById: reviewer.Id,
            Reason: "Hours don't match site logs");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Status.Should().Be(TimeEntryStatus.Rejected);
        result.Value.RejectionReason.Should().Be("Hours don't match site logs");
    }

    [Fact]
    public async Task Handle_PreviouslyApprovedEntry_CanBeRejected()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, reviewer, project, costCode) = await SetupTestData(db);
        var timeEntry = await CreateTimeEntry(db, employee, project, costCode, TimeEntryStatus.Approved);
        timeEntry.ApprovedById = reviewer.Id;
        timeEntry.ApprovedAt = DateTime.UtcNow.AddHours(-1);
        timeEntry.ApprovalComments = "Previous approval";
        await db.SaveChangesAsync();

        var handler = new RejectTimeEntryHandler(db);
        var command = new RejectTimeEntryCommand(
            TimeEntryId: timeEntry.Id,
            RejectedById: reviewer.Id,
            Reason: "Error found after initial approval");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(TimeEntryStatus.Rejected);
        result.Value.ApprovedById.Should().BeNull(); // Cleared
        result.Value.ApprovedAt.Should().BeNull(); // Cleared
        result.Value.ApprovalComments.Should().BeNull(); // Cleared
    }

    [Fact]
    public async Task Handle_AlreadyRejectedEntry_CanBeRejectedAgain()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, reviewer, project, costCode) = await SetupTestData(db);
        var timeEntry = await CreateTimeEntry(db, employee, project, costCode, TimeEntryStatus.Rejected);
        timeEntry.RejectionReason = "First rejection reason";
        await db.SaveChangesAsync();

        var handler = new RejectTimeEntryHandler(db);
        var command = new RejectTimeEntryCommand(
            TimeEntryId: timeEntry.Id,
            RejectedById: reviewer.Id,
            Reason: "Updated rejection with more details");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(TimeEntryStatus.Rejected);
        result.Value.RejectionReason.Should().Be("Updated rejection with more details");
    }

    [Fact]
    public async Task Handle_TimeEntryNotFound_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (_, reviewer, _, _) = await SetupTestData(db);

        var handler = new RejectTimeEntryHandler(db);
        var command = new RejectTimeEntryCommand(
            TimeEntryId: Guid.NewGuid(),
            RejectedById: reviewer.Id,
            Reason: "Some reason");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
        result.Error.Should().Contain("not found");
    }

    [Fact]
    public async Task Handle_DraftEntry_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, reviewer, project, costCode) = await SetupTestData(db);
        var timeEntry = await CreateTimeEntry(db, employee, project, costCode, TimeEntryStatus.Draft);

        var handler = new RejectTimeEntryHandler(db);
        var command = new RejectTimeEntryCommand(
            TimeEntryId: timeEntry.Id,
            RejectedById: reviewer.Id,
            Reason: "Trying to reject draft");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
        result.Error.Should().Contain("draft");
    }

    [Fact]
    public async Task Handle_EmptyReason_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, reviewer, project, costCode) = await SetupTestData(db);
        var timeEntry = await CreateTimeEntry(db, employee, project, costCode, TimeEntryStatus.Submitted);

        var handler = new RejectTimeEntryHandler(db);
        var command = new RejectTimeEntryCommand(
            TimeEntryId: timeEntry.Id,
            RejectedById: reviewer.Id,
            Reason: "");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("REASON_REQUIRED");
    }

    [Fact]
    public async Task Handle_WhitespaceOnlyReason_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, reviewer, project, costCode) = await SetupTestData(db);
        var timeEntry = await CreateTimeEntry(db, employee, project, costCode, TimeEntryStatus.Submitted);

        var handler = new RejectTimeEntryHandler(db);
        var command = new RejectTimeEntryCommand(
            TimeEntryId: timeEntry.Id,
            RejectedById: reviewer.Id,
            Reason: "   ");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("REASON_REQUIRED");
    }

    [Fact]
    public async Task Handle_ReviewerNotFound_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, _, project, costCode) = await SetupTestData(db);
        var timeEntry = await CreateTimeEntry(db, employee, project, costCode, TimeEntryStatus.Submitted);

        var handler = new RejectTimeEntryHandler(db);
        var command = new RejectTimeEntryCommand(
            TimeEntryId: timeEntry.Id,
            RejectedById: Guid.NewGuid(), // Non-existent reviewer
            Reason: "Some reason");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("REVIEWER_NOT_FOUND");
    }

    [Fact]
    public async Task Handle_SetsUpdatedAtTimestamp()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, reviewer, project, costCode) = await SetupTestData(db);
        var timeEntry = await CreateTimeEntry(db, employee, project, costCode, TimeEntryStatus.Submitted);
        var originalUpdatedAt = timeEntry.UpdatedAt;

        var handler = new RejectTimeEntryHandler(db);
        var command = new RejectTimeEntryCommand(
            TimeEntryId: timeEntry.Id,
            RejectedById: reviewer.Id,
            Reason: "Hours incorrect");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.UpdatedAt.Should().NotBeNull();
        result.Value.UpdatedAt.Should().BeAfter(originalUpdatedAt ?? DateTime.MinValue);
    }

    [Fact]
    public async Task Handle_IncludesEmployeeAndProjectDetails()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, reviewer, project, costCode) = await SetupTestData(db);
        var timeEntry = await CreateTimeEntry(db, employee, project, costCode, TimeEntryStatus.Submitted);

        var handler = new RejectTimeEntryHandler(db);
        var command = new RejectTimeEntryCommand(
            TimeEntryId: timeEntry.Id,
            RejectedById: reviewer.Id,
            Reason: "Hours don't match");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.EmployeeName.Should().Be("John Worker");
        result.Value.ProjectName.Should().Be("Test Bridge Project");
        result.Value.CostCodeDescription.Should().Be("General Labor");
    }

    #region Helper Methods

    private static async Task<(Employee worker, Employee reviewer, Project project, CostCode costCode)> SetupTestData(
        Pitbull.Core.Data.PitbullDbContext db)
    {
        var worker = new Employee
        {
            EmployeeNumber = "E001",
            FirstName = "John",
            LastName = "Worker",
            IsActive = true,
            Classification = EmployeeClassification.Hourly,
            BaseHourlyRate = 35m
        };
        db.Set<Employee>().Add(worker);

        var reviewer = new Employee
        {
            EmployeeNumber = "E000",
            FirstName = "Jane",
            LastName = "Manager",
            IsActive = true,
            Classification = EmployeeClassification.Salaried,
            BaseHourlyRate = 50m
        };
        db.Set<Employee>().Add(reviewer);

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
            EmployeeId = worker.Id,
            ProjectId = project.Id,
            Role = AssignmentRole.Worker,
            StartDate = new DateOnly(2026, 1, 1),
            IsActive = true
        };
        db.Set<ProjectAssignment>().Add(assignment);

        await db.SaveChangesAsync();
        return (worker, reviewer, project, costCode);
    }

    private static async Task<TimeEntry> CreateTimeEntry(
        Pitbull.Core.Data.PitbullDbContext db,
        Employee employee,
        Project project,
        CostCode costCode,
        TimeEntryStatus status)
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
