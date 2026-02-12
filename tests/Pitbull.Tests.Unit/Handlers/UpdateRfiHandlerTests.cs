using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.RFIs.Domain;
using Pitbull.RFIs.Features.UpdateRfi;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class UpdateRfiHandlerTests
{
    private static Rfi CreateTestRfi(
        Guid? projectId = null,
        int number = 1,
        string subject = "Original subject",
        string question = "Original question?",
        RfiStatus status = RfiStatus.Open,
        RfiPriority priority = RfiPriority.Normal)
    {
        return new Rfi
        {
            Id = Guid.NewGuid(),
            Number = number,
            Subject = subject,
            Question = question,
            Status = status,
            Priority = priority,
            ProjectId = projectId ?? Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId
        };
    }

    private static UpdateRfiCommand CreateUpdateCommand(
        Guid id,
        Guid projectId,
        string subject = "Updated subject",
        string question = "Updated question?",
        string? answer = null,
        RfiStatus status = RfiStatus.Open,
        RfiPriority priority = RfiPriority.Normal,
        DateTime? dueDate = null,
        Guid? assignedToUserId = null,
        string? assignedToName = null,
        Guid? ballInCourtUserId = null,
        string? ballInCourtName = null)
    {
        return new UpdateRfiCommand(
            Id: id,
            ProjectId: projectId,
            Subject: subject,
            Question: question,
            Answer: answer,
            Status: status,
            Priority: priority,
            DueDate: dueDate,
            AssignedToUserId: assignedToUserId,
            AssignedToName: assignedToName,
            BallInCourtUserId: ballInCourtUserId,
            BallInCourtName: ballInCourtName
        );
    }

    [Fact]
    public async Task Handle_ExistingRfi_UpdatesAndReturnsDto()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var rfi = CreateTestRfi(projectId: projectId);
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();

        var handler = new UpdateRfiHandler(db);
        var command = CreateUpdateCommand(rfi.Id, projectId,
            subject: "New subject",
            question: "New question?");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Subject.Should().Be("New subject");
        result.Value.Question.Should().Be("New question?");
    }

    [Fact]
    public async Task Handle_NonExistentRfi_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new UpdateRfiHandler(db);
        var command = CreateUpdateCommand(Guid.NewGuid(), Guid.NewGuid());

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
        result.Error.Should().Be("RFI not found");
    }

    [Fact]
    public async Task Handle_WrongProject_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var rfi = CreateTestRfi(projectId: Guid.NewGuid());
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();

        var handler = new UpdateRfiHandler(db);
        var wrongProjectId = Guid.NewGuid();
        var command = CreateUpdateCommand(rfi.Id, wrongProjectId);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task Handle_PersistsChangesToDatabase()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var rfi = CreateTestRfi(projectId: projectId);
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();

        var handler = new UpdateRfiHandler(db);
        var command = CreateUpdateCommand(rfi.Id, projectId, subject: "Persisted subject");

        // Act
        await handler.Handle(command, CancellationToken.None);

        // Assert
        var updated = await db.Set<Rfi>().FirstAsync(r => r.Id == rfi.Id);
        updated.Subject.Should().Be("Persisted subject");
    }

    [Fact]
    public async Task Handle_UpdatePriority_ChangesPriority()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var rfi = CreateTestRfi(projectId: projectId, priority: RfiPriority.Low);
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();

        var handler = new UpdateRfiHandler(db);
        var command = CreateUpdateCommand(rfi.Id, projectId, priority: RfiPriority.Urgent);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Priority.Should().Be(RfiPriority.Urgent);
    }

    [Fact]
    public async Task Handle_AddAnswer_SetsAnswer()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var rfi = CreateTestRfi(projectId: projectId);
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();

        var handler = new UpdateRfiHandler(db);
        var command = CreateUpdateCommand(rfi.Id, projectId, answer: "This is the official answer.");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Answer.Should().Be("This is the official answer.");
    }

    [Fact]
    public async Task Handle_TransitionFromOpenToAnswered_SetsAnsweredAtTimestamp()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var rfi = CreateTestRfi(projectId: projectId, status: RfiStatus.Open);
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();
        var before = DateTime.UtcNow;

        var handler = new UpdateRfiHandler(db);
        var command = CreateUpdateCommand(rfi.Id, projectId,
            status: RfiStatus.Answered,
            answer: "Here is the answer.");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(RfiStatus.Answered);
        result.Value.AnsweredAt.Should().NotBeNull();
        result.Value.AnsweredAt.Should().BeOnOrAfter(before);
        result.Value.AnsweredAt.Should().BeOnOrBefore(DateTime.UtcNow);
    }

    [Fact]
    public async Task Handle_TransitionToClosed_SetsClosedAtTimestamp()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var rfi = CreateTestRfi(projectId: projectId, status: RfiStatus.Answered);
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();
        var before = DateTime.UtcNow;

        var handler = new UpdateRfiHandler(db);
        var command = CreateUpdateCommand(rfi.Id, projectId, status: RfiStatus.Closed);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(RfiStatus.Closed);
        result.Value.ClosedAt.Should().NotBeNull();
        result.Value.ClosedAt.Should().BeOnOrAfter(before);
        result.Value.ClosedAt.Should().BeOnOrBefore(DateTime.UtcNow);
    }

    [Fact]
    public async Task Handle_TransitionFromOpenToClosed_SetsClosedAtTimestamp()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var rfi = CreateTestRfi(projectId: projectId, status: RfiStatus.Open);
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();

        var handler = new UpdateRfiHandler(db);
        var command = CreateUpdateCommand(rfi.Id, projectId, status: RfiStatus.Closed);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.ClosedAt.Should().NotBeNull();
        // AnsweredAt should not be set since we went directly to Closed
        result.Value.AnsweredAt.Should().BeNull();
    }

    [Fact]
    public async Task Handle_AlreadyClosed_DoesNotUpdateClosedAt()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var originalClosedAt = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc);
        var rfi = new Rfi
        {
            Id = Guid.NewGuid(),
            Number = 1,
            Subject = "Already closed",
            Question = "Question?",
            Status = RfiStatus.Closed,
            Priority = RfiPriority.Normal,
            ClosedAt = originalClosedAt,
            ProjectId = projectId,
            TenantId = TestDbContextFactory.TestTenantId
        };
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();

        var handler = new UpdateRfiHandler(db);
        var command = CreateUpdateCommand(rfi.Id, projectId,
            status: RfiStatus.Closed,
            subject: "Updated but still closed");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.ClosedAt.Should().Be(originalClosedAt); // Should not change
    }

    [Fact]
    public async Task Handle_UpdateAssignment_ChangesAssignedUser()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var rfi = CreateTestRfi(projectId: projectId);
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();

        var newUserId = Guid.NewGuid();
        var handler = new UpdateRfiHandler(db);
        var command = CreateUpdateCommand(rfi.Id, projectId,
            assignedToUserId: newUserId,
            assignedToName: "New Assignee");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.AssignedToUserId.Should().Be(newUserId);
        result.Value.AssignedToName.Should().Be("New Assignee");
    }

    [Fact]
    public async Task Handle_UpdateBallInCourt_ChangesBallInCourtUser()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var rfi = CreateTestRfi(projectId: projectId);
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();

        var newUserId = Guid.NewGuid();
        var handler = new UpdateRfiHandler(db);
        var command = CreateUpdateCommand(rfi.Id, projectId,
            ballInCourtUserId: newUserId,
            ballInCourtName: "New Ball Holder");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.BallInCourtUserId.Should().Be(newUserId);
        result.Value.BallInCourtName.Should().Be("New Ball Holder");
    }

    [Fact]
    public async Task Handle_UpdateDueDate_ChangesDueDate()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var rfi = CreateTestRfi(projectId: projectId);
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();

        var newDueDate = new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc);
        var handler = new UpdateRfiHandler(db);
        var command = CreateUpdateCommand(rfi.Id, projectId, dueDate: newDueDate);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.DueDate.Should().Be(newDueDate);
    }

    [Fact]
    public async Task Handle_ClearAnswer_SetsAnswerToNull()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var rfi = new Rfi
        {
            Id = Guid.NewGuid(),
            Number = 1,
            Subject = "Has answer",
            Question = "Question?",
            Answer = "Previous answer",
            Status = RfiStatus.Answered,
            Priority = RfiPriority.Normal,
            ProjectId = projectId,
            TenantId = TestDbContextFactory.TestTenantId
        };
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();

        var handler = new UpdateRfiHandler(db);
        var command = CreateUpdateCommand(rfi.Id, projectId,
            answer: null,
            status: RfiStatus.Open);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Answer.Should().BeNull();
    }

    [Fact]
    public async Task Handle_PreservesNumberOnUpdate()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var rfi = CreateTestRfi(projectId: projectId, number: 42);
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();

        var handler = new UpdateRfiHandler(db);
        var command = CreateUpdateCommand(rfi.Id, projectId, subject: "New subject");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Number.Should().Be(42); // Number should not change
    }

    [Fact]
    public async Task Handle_PreservesProjectIdOnUpdate()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var rfi = CreateTestRfi(projectId: projectId);
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();

        var handler = new UpdateRfiHandler(db);
        var command = CreateUpdateCommand(rfi.Id, projectId, subject: "New subject");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.ProjectId.Should().Be(projectId); // ProjectId should not change
    }

    [Fact]
    public async Task Handle_UpdateMultipleFields_AllFieldsUpdated()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var rfi = CreateTestRfi(projectId: projectId);
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();

        var assignedUserId = Guid.NewGuid();
        var ballInCourtUserId = Guid.NewGuid();
        var dueDate = new DateTime(2026, 7, 15, 0, 0, 0, DateTimeKind.Utc);

        var handler = new UpdateRfiHandler(db);
        var command = new UpdateRfiCommand(
            Id: rfi.Id,
            ProjectId: projectId,
            Subject: "Comprehensive update",
            Question: "New comprehensive question?",
            Answer: "Comprehensive answer",
            Status: RfiStatus.Answered,
            Priority: RfiPriority.Urgent,
            DueDate: dueDate,
            AssignedToUserId: assignedUserId,
            AssignedToName: "Assigned Person",
            BallInCourtUserId: ballInCourtUserId,
            BallInCourtName: "Ball Holder"
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var dto = result.Value!;
        dto.Subject.Should().Be("Comprehensive update");
        dto.Question.Should().Be("New comprehensive question?");
        dto.Answer.Should().Be("Comprehensive answer");
        dto.Status.Should().Be(RfiStatus.Answered);
        dto.Priority.Should().Be(RfiPriority.Urgent);
        dto.DueDate.Should().Be(dueDate);
        dto.AssignedToUserId.Should().Be(assignedUserId);
        dto.AssignedToName.Should().Be("Assigned Person");
        dto.BallInCourtUserId.Should().Be(ballInCourtUserId);
        dto.BallInCourtName.Should().Be("Ball Holder");
    }
}
