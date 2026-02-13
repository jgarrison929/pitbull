using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features.UpdateTimeEntry;

namespace Pitbull.Tests.Unit.Handlers;

public class UpdateTimeEntryHandlerTests
{
    [Fact]
    public async Task Handle_UpdateHours_Success()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (timeEntry, _, _) = await SetupTestData(db);
        var handler = new UpdateTimeEntryHandler(db);

        var command = new UpdateTimeEntryCommand(
            TimeEntryId: timeEntry.Id,
            RegularHours: 10m,
            OvertimeHours: 3m
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.RegularHours.Should().Be(10m);
        result.Value.OvertimeHours.Should().Be(3m);
        result.Value.TotalHours.Should().Be(13m);
    }

    [Fact]
    public async Task Handle_ApproveTimeEntry_Success()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (timeEntry, supervisor, _) = await SetupTestData(db);
        var handler = new UpdateTimeEntryHandler(db);

        var command = new UpdateTimeEntryCommand(
            TimeEntryId: timeEntry.Id,
            NewStatus: TimeEntryStatus.Approved,
            ApproverId: supervisor.Id,
            ApproverNotes: "Looks good!"
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(TimeEntryStatus.Approved);
        result.Value.ApprovedById.Should().Be(supervisor.Id);
        result.Value.ApprovalComments.Should().Be("Looks good!");
    }

    [Fact]
    public async Task Handle_RejectTimeEntry_Success()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (timeEntry, supervisor, _) = await SetupTestData(db);
        var handler = new UpdateTimeEntryHandler(db);

        var command = new UpdateTimeEntryCommand(
            TimeEntryId: timeEntry.Id,
            NewStatus: TimeEntryStatus.Rejected,
            ApproverId: supervisor.Id,
            ApproverNotes: "Hours seem high, please verify"
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(TimeEntryStatus.Rejected);
        result.Value.RejectionReason.Should().Be("Hours seem high, please verify");
    }

    [Fact]
    public async Task Handle_RejectWithoutReason_Fails()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (timeEntry, supervisor, _) = await SetupTestData(db);
        var handler = new UpdateTimeEntryHandler(db);

        var command = new UpdateTimeEntryCommand(
            TimeEntryId: timeEntry.Id,
            NewStatus: TimeEntryStatus.Rejected,
            ApproverId: supervisor.Id,
            ApproverNotes: null // Missing rejection reason
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("MISSING_REJECTION_REASON");
    }

    [Fact]
    public async Task Handle_ApproveWithoutApproverId_Fails()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (timeEntry, _, _) = await SetupTestData(db);
        var handler = new UpdateTimeEntryHandler(db);

        var command = new UpdateTimeEntryCommand(
            TimeEntryId: timeEntry.Id,
            NewStatus: TimeEntryStatus.Approved,
            ApproverId: null // Missing approver
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("MISSING_APPROVER");
    }

    [Fact]
    public async Task Handle_HourlyWorkerCannotApprove_Fails()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (timeEntry, _, worker) = await SetupTestData(db);
        var handler = new UpdateTimeEntryHandler(db);

        var command = new UpdateTimeEntryCommand(
            TimeEntryId: timeEntry.Id,
            NewStatus: TimeEntryStatus.Approved,
            ApproverId: worker.Id // Regular worker trying to approve
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("UNAUTHORIZED");
    }

    [Fact]
    public async Task Handle_InvalidStatusTransition_Fails()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (timeEntry, supervisor, _) = await SetupTestData(db);

        // Set entry to Draft status first
        timeEntry.Status = TimeEntryStatus.Draft;
        await db.SaveChangesAsync();

        var handler = new UpdateTimeEntryHandler(db);

        // Try to approve directly from Draft (should require Submitted first)
        var command = new UpdateTimeEntryCommand(
            TimeEntryId: timeEntry.Id,
            NewStatus: TimeEntryStatus.Approved,
            ApproverId: supervisor.Id
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_TRANSITION");
    }

    [Fact]
    public async Task Handle_CannotModifyHoursOnApproved_Fails()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (timeEntry, supervisor, _) = await SetupTestData(db);

        // First approve the entry
        timeEntry.Status = TimeEntryStatus.Approved;
        await db.SaveChangesAsync();

        var handler = new UpdateTimeEntryHandler(db);

        var command = new UpdateTimeEntryCommand(
            TimeEntryId: timeEntry.Id,
            RegularHours: 12m // Trying to modify hours on approved entry
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task Handle_TimeEntryNotFound_Fails()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new UpdateTimeEntryHandler(db);

        var command = new UpdateTimeEntryCommand(
            TimeEntryId: Guid.NewGuid(),
            RegularHours: 8m
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task Handle_SubmitFromDraft_Success()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (timeEntry, _, _) = await SetupTestData(db);
        timeEntry.Status = TimeEntryStatus.Draft;
        await db.SaveChangesAsync();

        var handler = new UpdateTimeEntryHandler(db);

        var command = new UpdateTimeEntryCommand(
            TimeEntryId: timeEntry.Id,
            NewStatus: TimeEntryStatus.Submitted
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(TimeEntryStatus.Submitted);
    }

    [Fact]
    public async Task Handle_ResubmitAfterRejection_Success()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (timeEntry, _, _) = await SetupTestData(db);
        timeEntry.Status = TimeEntryStatus.Rejected;
        await db.SaveChangesAsync();

        var handler = new UpdateTimeEntryHandler(db);

        var command = new UpdateTimeEntryCommand(
            TimeEntryId: timeEntry.Id,
            NewStatus: TimeEntryStatus.Submitted,
            RegularHours: 6m // Corrected hours
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(TimeEntryStatus.Submitted);
        result.Value.RegularHours.Should().Be(6m);
    }

    private static async Task<(TimeEntry, Employee supervisor, Employee worker)> SetupTestData(
        Pitbull.Core.Data.PitbullDbContext db)
    {
        var supervisor = new Employee
        {
            EmployeeNumber = "S001",
            FirstName = "Bob",
            LastName = "Supervisor",
            IsActive = true,
            Classification = EmployeeClassification.Supervisor,
            BaseHourlyRate = 50m
        };
        db.Set<Employee>().Add(supervisor);

        var worker = new Employee
        {
            EmployeeNumber = "E001",
            FirstName = "John",
            LastName = "Worker",
            IsActive = true,
            Classification = EmployeeClassification.Hourly,
            BaseHourlyRate = 35m,
            SupervisorId = supervisor.Id
        };
        db.Set<Employee>().Add(worker);

        var project = new Project
        {
            Name = "Test Project",
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

        var timeEntry = new TimeEntry
        {
            Date = new DateOnly(2026, 2, 5),
            EmployeeId = worker.Id,
            ProjectId = project.Id,
            CostCodeId = costCode.Id,
            RegularHours = 8m,
            OvertimeHours = 0m,
            DoubletimeHours = 0m,
            Status = TimeEntryStatus.Submitted
        };
        db.Set<TimeEntry>().Add(timeEntry);
        await db.SaveChangesAsync();

        return (timeEntry, supervisor, worker);
    }
}
