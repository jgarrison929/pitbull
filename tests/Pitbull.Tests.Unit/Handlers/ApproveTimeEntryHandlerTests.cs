using FluentAssertions;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features.ApproveTimeEntry;

namespace Pitbull.Tests.Unit.Handlers;

public class ApproveTimeEntryHandlerTests
{
    [Fact]
    public async Task Handle_ValidSubmittedEntry_ApprovesSuccessfully()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, approver, project, costCode) = await SetupTestData(db);
        var timeEntry = await CreateTimeEntry(db, employee, project, costCode, TimeEntryStatus.Submitted);

        var handler = new ApproveTimeEntryHandler(db);
        var command = new ApproveTimeEntryCommand(
            TimeEntryId: timeEntry.Id,
            ApprovedById: approver.Id,
            Comments: "Approved - hours look correct");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Status.Should().Be(TimeEntryStatus.Approved);
        result.Value.ApprovedById.Should().Be(approver.Id);
        result.Value.ApprovedByName.Should().Be("Jane Manager");
        result.Value.ApprovedAt.Should().NotBeNull();
        result.Value.ApprovalComments.Should().Be("Approved - hours look correct");
    }

    [Fact]
    public async Task Handle_ValidRejectedEntry_CanBeApproved()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, approver, project, costCode) = await SetupTestData(db);
        var timeEntry = await CreateTimeEntry(db, employee, project, costCode, TimeEntryStatus.Rejected);
        timeEntry.RejectionReason = "Previous rejection reason";
        await db.SaveChangesAsync();

        var handler = new ApproveTimeEntryHandler(db);
        var command = new ApproveTimeEntryCommand(
            TimeEntryId: timeEntry.Id,
            ApprovedById: approver.Id,
            Comments: "Now approved after correction");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(TimeEntryStatus.Approved);
        result.Value.RejectionReason.Should().BeNull(); // Should be cleared
    }

    [Fact]
    public async Task Handle_WithoutComments_ApprovesSuccessfully()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, approver, project, costCode) = await SetupTestData(db);
        var timeEntry = await CreateTimeEntry(db, employee, project, costCode, TimeEntryStatus.Submitted);

        var handler = new ApproveTimeEntryHandler(db);
        var command = new ApproveTimeEntryCommand(
            TimeEntryId: timeEntry.Id,
            ApprovedById: approver.Id);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(TimeEntryStatus.Approved);
        result.Value.ApprovalComments.Should().BeNull();
    }

    [Fact]
    public async Task Handle_TimeEntryNotFound_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (_, approver, _, _) = await SetupTestData(db);

        var handler = new ApproveTimeEntryHandler(db);
        var command = new ApproveTimeEntryCommand(
            TimeEntryId: Guid.NewGuid(),
            ApprovedById: approver.Id);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
        result.Error.Should().Contain("not found");
    }

    [Fact]
    public async Task Handle_AlreadyApproved_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, approver, project, costCode) = await SetupTestData(db);
        var timeEntry = await CreateTimeEntry(db, employee, project, costCode, TimeEntryStatus.Approved);
        timeEntry.ApprovedById = approver.Id;
        timeEntry.ApprovedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var handler = new ApproveTimeEntryHandler(db);
        var command = new ApproveTimeEntryCommand(
            TimeEntryId: timeEntry.Id,
            ApprovedById: approver.Id);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("ALREADY_APPROVED");
    }

    [Fact]
    public async Task Handle_DraftEntry_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, approver, project, costCode) = await SetupTestData(db);
        var timeEntry = await CreateTimeEntry(db, employee, project, costCode, TimeEntryStatus.Draft);

        var handler = new ApproveTimeEntryHandler(db);
        var command = new ApproveTimeEntryCommand(
            TimeEntryId: timeEntry.Id,
            ApprovedById: approver.Id);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
        result.Error.Should().Contain("draft");
    }

    [Fact]
    public async Task Handle_ApproverNotFound_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, _, project, costCode) = await SetupTestData(db);
        var timeEntry = await CreateTimeEntry(db, employee, project, costCode, TimeEntryStatus.Submitted);

        var handler = new ApproveTimeEntryHandler(db);
        var command = new ApproveTimeEntryCommand(
            TimeEntryId: timeEntry.Id,
            ApprovedById: Guid.NewGuid()); // Non-existent approver

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("APPROVER_NOT_FOUND");
    }

    [Fact]
    public async Task Handle_SetsUpdatedAtTimestamp()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, approver, project, costCode) = await SetupTestData(db);
        var timeEntry = await CreateTimeEntry(db, employee, project, costCode, TimeEntryStatus.Submitted);
        var originalUpdatedAt = timeEntry.UpdatedAt;

        var handler = new ApproveTimeEntryHandler(db);
        var command = new ApproveTimeEntryCommand(
            TimeEntryId: timeEntry.Id,
            ApprovedById: approver.Id);

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
        var (employee, approver, project, costCode) = await SetupTestData(db);
        var timeEntry = await CreateTimeEntry(db, employee, project, costCode, TimeEntryStatus.Submitted);

        var handler = new ApproveTimeEntryHandler(db);
        var command = new ApproveTimeEntryCommand(
            TimeEntryId: timeEntry.Id,
            ApprovedById: approver.Id);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.EmployeeName.Should().Be("John Worker");
        result.Value.ProjectName.Should().Be("Test Bridge Project");
        result.Value.CostCodeDescription.Should().Be("General Labor");
    }

    #region Helper Methods

    private static async Task<(Employee worker, Employee approver, Project project, CostCode costCode)> SetupTestData(
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

        var approver = new Employee
        {
            EmployeeNumber = "E000",
            FirstName = "Jane",
            LastName = "Manager",
            IsActive = true,
            Classification = EmployeeClassification.Salaried,
            BaseHourlyRate = 50m
        };
        db.Set<Employee>().Add(approver);

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
        return (worker, approver, project, costCode);
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
