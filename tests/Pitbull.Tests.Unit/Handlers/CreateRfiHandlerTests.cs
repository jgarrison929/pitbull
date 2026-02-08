using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.RFIs.Domain;
using Pitbull.RFIs.Features.CreateRfi;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class CreateRfiHandlerTests
{
    private static CreateRfiCommand CreateValidCommand(
        Guid? projectId = null,
        string subject = "Clarification on foundation spec",
        string question = "What is the required rebar spacing for the foundation?",
        RfiPriority priority = RfiPriority.Normal,
        DateTime? dueDate = null,
        Guid? assignedToUserId = null,
        string? assignedToName = null,
        Guid? ballInCourtUserId = null,
        string? ballInCourtName = null,
        string? createdByName = null)
    {
        return new CreateRfiCommand(
            ProjectId: projectId ?? Guid.NewGuid(),
            Subject: subject,
            Question: question,
            Priority: priority,
            DueDate: dueDate,
            AssignedToUserId: assignedToUserId,
            AssignedToName: assignedToName,
            BallInCourtUserId: ballInCourtUserId,
            BallInCourtName: ballInCourtName,
            CreatedByName: createdByName
        );
    }

    [Fact]
    public async Task Handle_ValidCommand_CreatesRfiAndReturnsDto()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateRfiHandler(db);
        var projectId = Guid.NewGuid();
        var command = CreateValidCommand(
            projectId: projectId,
            subject: "Electrical panel location",
            question: "Where should the main electrical panel be installed?",
            priority: RfiPriority.High,
            assignedToName: "John Doe"
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Subject.Should().Be("Electrical panel location");
        result.Value.Question.Should().Be("Where should the main electrical panel be installed?");
        result.Value.Priority.Should().Be(RfiPriority.High);
        result.Value.ProjectId.Should().Be(projectId);
        result.Value.AssignedToName.Should().Be("John Doe");
        result.Value.Id.Should().NotBeEmpty();
    }

    [Fact]
    public async Task Handle_ValidCommand_PersistsRfiToDatabase()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateRfiHandler(db);
        var projectId = Guid.NewGuid();
        var command = CreateValidCommand(projectId: projectId);

        // Act
        await handler.Handle(command, CancellationToken.None);

        // Assert
        var saved = await db.Set<Rfi>().FirstOrDefaultAsync();
        saved.Should().NotBeNull();
        saved!.Subject.Should().Be("Clarification on foundation spec");
        saved.ProjectId.Should().Be(projectId);
        saved.TenantId.Should().Be(TestDbContextFactory.TestTenantId);
    }

    [Fact]
    public async Task Handle_FirstRfiInProject_AssignsNumber1()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateRfiHandler(db);
        var projectId = Guid.NewGuid();
        var command = CreateValidCommand(projectId: projectId);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Number.Should().Be(1);
    }

    [Fact]
    public async Task Handle_SecondRfiInProject_AssignsNumber2()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateRfiHandler(db);
        var projectId = Guid.NewGuid();

        // Create first RFI
        var firstCommand = CreateValidCommand(projectId: projectId, subject: "First RFI");
        await handler.Handle(firstCommand, CancellationToken.None);

        // Create second RFI
        var secondCommand = CreateValidCommand(projectId: projectId, subject: "Second RFI");

        // Act
        var result = await handler.Handle(secondCommand, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Number.Should().Be(2);
    }

    [Fact]
    public async Task Handle_RfisInDifferentProjects_HaveIndependentNumbering()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateRfiHandler(db);
        var project1Id = Guid.NewGuid();
        var project2Id = Guid.NewGuid();

        // Create RFI in project 1
        var command1 = CreateValidCommand(projectId: project1Id, subject: "Project 1 RFI");
        await handler.Handle(command1, CancellationToken.None);

        // Create RFI in project 2
        var command2 = CreateValidCommand(projectId: project2Id, subject: "Project 2 RFI");

        // Act
        var result = await handler.Handle(command2, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Number.Should().Be(1); // First RFI in project 2
    }

    [Fact]
    public async Task Handle_SetsStatusToOpen()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateRfiHandler(db);
        var command = CreateValidCommand();

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(RfiStatus.Open);
    }

    [Fact]
    public async Task Handle_WithDueDate_SetsDueDate()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateRfiHandler(db);
        var dueDate = new DateTime(2026, 3, 15, 0, 0, 0, DateTimeKind.Utc);
        var command = CreateValidCommand(dueDate: dueDate);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.DueDate.Should().Be(dueDate);
    }

    [Fact]
    public async Task Handle_WithoutBallInCourt_DefaultsToAssignedUser()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateRfiHandler(db);
        var assignedUserId = Guid.NewGuid();
        var command = CreateValidCommand(
            assignedToUserId: assignedUserId,
            assignedToName: "Jane Smith",
            ballInCourtUserId: null,
            ballInCourtName: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.BallInCourtUserId.Should().Be(assignedUserId);
        result.Value.BallInCourtName.Should().Be("Jane Smith");
    }

    [Fact]
    public async Task Handle_WithExplicitBallInCourt_UsesBallInCourt()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateRfiHandler(db);
        var assignedUserId = Guid.NewGuid();
        var ballInCourtUserId = Guid.NewGuid();
        var command = CreateValidCommand(
            assignedToUserId: assignedUserId,
            assignedToName: "Jane Smith",
            ballInCourtUserId: ballInCourtUserId,
            ballInCourtName: "Bob Johnson"
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.BallInCourtUserId.Should().Be(ballInCourtUserId);
        result.Value.BallInCourtName.Should().Be("Bob Johnson");
    }

    [Fact]
    public async Task Handle_WithCreatedByName_SetsCreatedByName()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateRfiHandler(db);
        var command = CreateValidCommand(createdByName: "Mike Builder");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.CreatedByName.Should().Be("Mike Builder");
    }

    [Fact]
    public async Task Handle_SetsCreatedAtTimestamp()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateRfiHandler(db);
        var before = DateTime.UtcNow;
        var command = CreateValidCommand();

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Value!.CreatedAt.Should().BeOnOrAfter(before);
        result.Value.CreatedAt.Should().BeOnOrBefore(DateTime.UtcNow);
    }

    [Fact]
    public async Task Handle_SetsTenantIdFromContext()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateRfiHandler(db);
        var command = CreateValidCommand();

        // Act
        await handler.Handle(command, CancellationToken.None);

        // Assert
        var rfi = await db.Set<Rfi>().FirstAsync();
        rfi.TenantId.Should().Be(TestDbContextFactory.TestTenantId);
    }

    [Fact]
    public async Task Handle_AnswerIsNullOnCreation()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateRfiHandler(db);
        var command = CreateValidCommand();

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Answer.Should().BeNull();
        result.Value.AnsweredAt.Should().BeNull();
        result.Value.ClosedAt.Should().BeNull();
    }

    [Fact]
    public async Task Handle_AllPriorities_AreAccepted()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateRfiHandler(db);
        var projectId = Guid.NewGuid();

        foreach (var priority in Enum.GetValues<RfiPriority>())
        {
            var command = CreateValidCommand(projectId: projectId, priority: priority, subject: $"RFI {priority}");

            // Act
            var result = await handler.Handle(command, CancellationToken.None);

            // Assert
            result.IsSuccess.Should().BeTrue($"Priority {priority} should be accepted");
            result.Value!.Priority.Should().Be(priority);
        }
    }
}
