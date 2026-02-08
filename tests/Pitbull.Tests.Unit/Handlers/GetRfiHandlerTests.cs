using FluentAssertions;
using Pitbull.RFIs.Domain;
using Pitbull.RFIs.Features.GetRfi;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class GetRfiHandlerTests
{
    private static Rfi CreateTestRfi(
        Guid? projectId = null,
        int number = 1,
        string subject = "Test RFI",
        string question = "Test question?",
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

    [Fact]
    public async Task Handle_ExistingRfi_ReturnsDto()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var rfi = CreateTestRfi(projectId: projectId, subject: "Concrete spec question");
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();

        var handler = new GetRfiHandler(db);
        var query = new GetRfiQuery(projectId, rfi.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Id.Should().Be(rfi.Id);
        result.Value.Subject.Should().Be("Concrete spec question");
        result.Value.ProjectId.Should().Be(projectId);
    }

    [Fact]
    public async Task Handle_NonExistentRfi_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new GetRfiHandler(db);
        var query = new GetRfiQuery(Guid.NewGuid(), Guid.NewGuid());

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

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

        var handler = new GetRfiHandler(db);
        var wrongProjectId = Guid.NewGuid();
        var query = new GetRfiQuery(wrongProjectId, rfi.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task Handle_ReturnsAllRfiFields()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var assignedUserId = Guid.NewGuid();
        var ballInCourtUserId = Guid.NewGuid();
        var dueDate = new DateTime(2026, 4, 1, 0, 0, 0, DateTimeKind.Utc);
        var answeredAt = new DateTime(2026, 3, 20, 0, 0, 0, DateTimeKind.Utc);
        var closedAt = new DateTime(2026, 3, 25, 0, 0, 0, DateTimeKind.Utc);

        var rfi = new Rfi
        {
            Id = Guid.NewGuid(),
            Number = 5,
            Subject = "Full field test",
            Question = "What is the answer?",
            Answer = "This is the answer",
            Status = RfiStatus.Closed,
            Priority = RfiPriority.High,
            DueDate = dueDate,
            AnsweredAt = answeredAt,
            ClosedAt = closedAt,
            ProjectId = projectId,
            AssignedToUserId = assignedUserId,
            AssignedToName = "John Assignee",
            BallInCourtUserId = ballInCourtUserId,
            BallInCourtName = "Jane Ball",
            CreatedByName = "Mike Creator",
            TenantId = TestDbContextFactory.TestTenantId
        };
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();

        var handler = new GetRfiHandler(db);
        var query = new GetRfiQuery(projectId, rfi.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var dto = result.Value!;
        dto.Number.Should().Be(5);
        dto.Subject.Should().Be("Full field test");
        dto.Question.Should().Be("What is the answer?");
        dto.Answer.Should().Be("This is the answer");
        dto.Status.Should().Be(RfiStatus.Closed);
        dto.Priority.Should().Be(RfiPriority.High);
        dto.DueDate.Should().Be(dueDate);
        dto.AnsweredAt.Should().Be(answeredAt);
        dto.ClosedAt.Should().Be(closedAt);
        dto.AssignedToUserId.Should().Be(assignedUserId);
        dto.AssignedToName.Should().Be("John Assignee");
        dto.BallInCourtUserId.Should().Be(ballInCourtUserId);
        dto.BallInCourtName.Should().Be("Jane Ball");
        dto.CreatedByName.Should().Be("Mike Creator");
    }

    [Fact]
    public async Task Handle_RfiWithNullOptionalFields_ReturnsNulls()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var rfi = new Rfi
        {
            Id = Guid.NewGuid(),
            Number = 1,
            Subject = "Minimal RFI",
            Question = "Basic question?",
            Status = RfiStatus.Open,
            Priority = RfiPriority.Normal,
            ProjectId = projectId,
            TenantId = TestDbContextFactory.TestTenantId
            // All nullable fields left as null
        };
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();

        var handler = new GetRfiHandler(db);
        var query = new GetRfiQuery(projectId, rfi.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var dto = result.Value!;
        dto.Answer.Should().BeNull();
        dto.DueDate.Should().BeNull();
        dto.AnsweredAt.Should().BeNull();
        dto.ClosedAt.Should().BeNull();
        dto.AssignedToUserId.Should().BeNull();
        dto.AssignedToName.Should().BeNull();
        dto.BallInCourtUserId.Should().BeNull();
        dto.BallInCourtName.Should().BeNull();
        dto.CreatedByName.Should().BeNull();
    }
}
