using FluentAssertions;
using Pitbull.RFIs.Domain;
using Pitbull.RFIs.Features.ListRfis;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class ListRfisHandlerTests
{
    private static Rfi CreateTestRfi(
        Guid projectId,
        int number,
        string subject = "Test RFI",
        RfiStatus status = RfiStatus.Open,
        RfiPriority priority = RfiPriority.Normal,
        Guid? ballInCourtUserId = null,
        string? assignedToName = null)
    {
        return new Rfi
        {
            Id = Guid.NewGuid(),
            Number = number,
            Subject = subject,
            Question = $"Question for {subject}?",
            Status = status,
            Priority = priority,
            ProjectId = projectId,
            BallInCourtUserId = ballInCourtUserId,
            AssignedToName = assignedToName,
            TenantId = TestDbContextFactory.TestTenantId
        };
    }

    [Fact]
    public async Task Handle_EmptyProject_ReturnsEmptyList()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new ListRfisHandler(db);
        var query = new ListRfisQuery(Guid.NewGuid());

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().BeEmpty();
        result.Value.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task Handle_WithRfis_ReturnsPagedList()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();

        for (int i = 1; i <= 5; i++)
        {
            db.Set<Rfi>().Add(CreateTestRfi(projectId, i, $"RFI #{i}"));
        }
        await db.SaveChangesAsync();

        var handler = new ListRfisHandler(db);
        var query = new ListRfisQuery(projectId);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(5);
        result.Value.Items.Should().HaveCount(5);
    }

    [Fact]
    public async Task Handle_OrdersByNumberDescending()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();

        db.Set<Rfi>().Add(CreateTestRfi(projectId, 1));
        db.Set<Rfi>().Add(CreateTestRfi(projectId, 3));
        db.Set<Rfi>().Add(CreateTestRfi(projectId, 2));
        await db.SaveChangesAsync();

        var handler = new ListRfisHandler(db);
        var query = new ListRfisQuery(projectId);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().BeInDescendingOrder(r => r.Number);
        result.Value.Items[0].Number.Should().Be(3);
    }

    [Fact]
    public async Task Handle_FilterByStatus_ReturnsMatchingRfis()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();

        db.Set<Rfi>().Add(CreateTestRfi(projectId, 1, status: RfiStatus.Open));
        db.Set<Rfi>().Add(CreateTestRfi(projectId, 2, status: RfiStatus.Answered));
        db.Set<Rfi>().Add(CreateTestRfi(projectId, 3, status: RfiStatus.Open));
        db.Set<Rfi>().Add(CreateTestRfi(projectId, 4, status: RfiStatus.Closed));
        await db.SaveChangesAsync();

        var handler = new ListRfisHandler(db);
        var query = new ListRfisQuery(projectId, Status: RfiStatus.Open);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(2);
        result.Value.Items.Should().OnlyContain(r => r.Status == RfiStatus.Open);
    }

    [Fact]
    public async Task Handle_FilterByPriority_ReturnsMatchingRfis()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();

        db.Set<Rfi>().Add(CreateTestRfi(projectId, 1, priority: RfiPriority.Low));
        db.Set<Rfi>().Add(CreateTestRfi(projectId, 2, priority: RfiPriority.High));
        db.Set<Rfi>().Add(CreateTestRfi(projectId, 3, priority: RfiPriority.Normal));
        db.Set<Rfi>().Add(CreateTestRfi(projectId, 4, priority: RfiPriority.High));
        await db.SaveChangesAsync();

        var handler = new ListRfisHandler(db);
        var query = new ListRfisQuery(projectId, Priority: RfiPriority.High);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(2);
        result.Value.Items.Should().OnlyContain(r => r.Priority == RfiPriority.High);
    }

    [Fact]
    public async Task Handle_FilterByBallInCourtUserId_ReturnsMatchingRfis()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var user1 = Guid.NewGuid();
        var user2 = Guid.NewGuid();

        db.Set<Rfi>().Add(CreateTestRfi(projectId, 1, ballInCourtUserId: user1));
        db.Set<Rfi>().Add(CreateTestRfi(projectId, 2, ballInCourtUserId: user2));
        db.Set<Rfi>().Add(CreateTestRfi(projectId, 3, ballInCourtUserId: user1));
        await db.SaveChangesAsync();

        var handler = new ListRfisHandler(db);
        var query = new ListRfisQuery(projectId, BallInCourtUserId: user1);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(2);
        result.Value.Items.Should().OnlyContain(r => r.BallInCourtUserId == user1);
    }

    [Fact]
    public async Task Handle_SearchBySubject_ReturnsMatchingRfis()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();

        db.Set<Rfi>().Add(CreateTestRfi(projectId, 1, subject: "Concrete foundation spec"));
        db.Set<Rfi>().Add(CreateTestRfi(projectId, 2, subject: "Steel beam dimensions"));
        db.Set<Rfi>().Add(CreateTestRfi(projectId, 3, subject: "Concrete wall thickness"));
        await db.SaveChangesAsync();

        var handler = new ListRfisHandler(db);
        var query = new ListRfisQuery(projectId, Search: "concrete");

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(2);
    }

    [Fact]
    public async Task Handle_SearchByAssignedToName_ReturnsMatchingRfis()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();

        db.Set<Rfi>().Add(CreateTestRfi(projectId, 1, assignedToName: "John Smith"));
        db.Set<Rfi>().Add(CreateTestRfi(projectId, 2, assignedToName: "Jane Doe"));
        db.Set<Rfi>().Add(CreateTestRfi(projectId, 3, assignedToName: "John Johnson"));
        await db.SaveChangesAsync();

        var handler = new ListRfisHandler(db);
        var query = new ListRfisQuery(projectId, Search: "john");

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(2);
    }

    [Fact]
    public async Task Handle_SearchIsCaseInsensitive()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();

        db.Set<Rfi>().Add(CreateTestRfi(projectId, 1, subject: "ELECTRICAL Panel"));
        db.Set<Rfi>().Add(CreateTestRfi(projectId, 2, subject: "Electrical wiring"));
        db.Set<Rfi>().Add(CreateTestRfi(projectId, 3, subject: "electrical CONDUIT"));
        await db.SaveChangesAsync();

        var handler = new ListRfisHandler(db);
        var query = new ListRfisQuery(projectId, Search: "ElEcTrIcAl");

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(3);
    }

    [Fact]
    public async Task Handle_Pagination_ReturnsCorrectPage()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();

        for (int i = 1; i <= 15; i++)
        {
            db.Set<Rfi>().Add(CreateTestRfi(projectId, i, $"RFI #{i}"));
        }
        await db.SaveChangesAsync();

        var handler = new ListRfisHandler(db);
        var query = new ListRfisQuery(projectId) { Page = 2, PageSize = 5 };

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(15);
        result.Value.Items.Should().HaveCount(5);
        result.Value.Page.Should().Be(2);
        result.Value.PageSize.Should().Be(5);
        // Since ordered by Number descending: 15,14,13,12,11 on page 1, then 10,9,8,7,6 on page 2
        result.Value.Items[0].Number.Should().Be(10);
        result.Value.Items[result.Value.Items.Count - 1].Number.Should().Be(6);
    }

    [Fact]
    public async Task Handle_CombinedFilters_ReturnsMatchingRfis()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        var user1 = Guid.NewGuid();

        db.Set<Rfi>().Add(CreateTestRfi(projectId, 1, subject: "Concrete foundation",
            status: RfiStatus.Open, priority: RfiPriority.High, ballInCourtUserId: user1));
        db.Set<Rfi>().Add(CreateTestRfi(projectId, 2, subject: "Concrete wall",
            status: RfiStatus.Answered, priority: RfiPriority.High, ballInCourtUserId: user1));
        db.Set<Rfi>().Add(CreateTestRfi(projectId, 3, subject: "Steel beam",
            status: RfiStatus.Open, priority: RfiPriority.High, ballInCourtUserId: user1));
        db.Set<Rfi>().Add(CreateTestRfi(projectId, 4, subject: "Concrete slab",
            status: RfiStatus.Open, priority: RfiPriority.Low, ballInCourtUserId: user1));
        await db.SaveChangesAsync();

        var handler = new ListRfisHandler(db);
        var query = new ListRfisQuery(projectId,
            Status: RfiStatus.Open,
            Priority: RfiPriority.High,
            BallInCourtUserId: user1,
            Search: "concrete");

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
        result.Value.Items[0].Subject.Should().Be("Concrete foundation");
    }

    [Fact]
    public async Task Handle_OnlyReturnsRfisFromSpecifiedProject()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var project1 = Guid.NewGuid();
        var project2 = Guid.NewGuid();

        db.Set<Rfi>().Add(CreateTestRfi(project1, 1, "Project 1 RFI"));
        db.Set<Rfi>().Add(CreateTestRfi(project2, 1, "Project 2 RFI"));
        db.Set<Rfi>().Add(CreateTestRfi(project1, 2, "Project 1 RFI 2"));
        await db.SaveChangesAsync();

        var handler = new ListRfisHandler(db);
        var query = new ListRfisQuery(project1);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(2);
        result.Value.Items.Should().OnlyContain(r => r.ProjectId == project1);
    }

    [Fact]
    public async Task Handle_LastPage_ReturnsRemainingItems()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();

        for (int i = 1; i <= 13; i++)
        {
            db.Set<Rfi>().Add(CreateTestRfi(projectId, i, $"RFI #{i}"));
        }
        await db.SaveChangesAsync();

        var handler = new ListRfisHandler(db);
        var query = new ListRfisQuery(projectId) { Page = 3, PageSize = 5 };

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(13);
        result.Value.Items.Should().HaveCount(3); // Only 3 items on page 3
    }
}
