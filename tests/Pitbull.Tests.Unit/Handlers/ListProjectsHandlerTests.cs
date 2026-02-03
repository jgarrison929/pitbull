using FluentAssertions;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.ListProjects;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class ListProjectsHandlerTests
{
    private static async Task SeedProjects(
        Pitbull.Core.Data.PitbullDbContext db, int count,
        ProjectStatus? status = null, ProjectType? type = null,
        string namePrefix = "Project")
    {
        for (int i = 1; i <= count; i++)
        {
            db.Set<Project>().Add(new Project
            {
                Name = $"{namePrefix} {i}",
                Number = $"PRJ-{namePrefix}-{i:D3}",
                Status = status ?? ProjectStatus.Active,
                Type = type ?? ProjectType.Commercial,
                ContractAmount = i * 100_000m
            });
        }
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task Handle_ReturnsPagedResults()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        using var db = TestDbContextFactory.Create(dbName: dbName);
        await SeedProjects(db, 5);
        var handler = new ListProjectsHandler(db);
        var query = new ListProjectsQuery() { Page = 1, PageSize = 10 };

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(5);
        result.Value.TotalCount.Should().Be(5);
        result.Value.Page.Should().Be(1);
    }

    [Fact]
    public async Task Handle_PaginatesCorrectly_Page1()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        using var db = TestDbContextFactory.Create(dbName: dbName);
        await SeedProjects(db, 15);
        var handler = new ListProjectsHandler(db);
        var query = new ListProjectsQuery() { Page = 1, PageSize = 5 };

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(5);
        result.Value.TotalCount.Should().Be(15);
        result.Value.TotalPages.Should().Be(3);
        result.Value.HasNextPage.Should().BeTrue();
        result.Value.HasPreviousPage.Should().BeFalse();
    }

    [Fact]
    public async Task Handle_PaginatesCorrectly_Page2()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        using var db = TestDbContextFactory.Create(dbName: dbName);
        await SeedProjects(db, 15);
        var handler = new ListProjectsHandler(db);
        var query = new ListProjectsQuery() { Page = 2, PageSize = 5 };

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.Value!.Items.Should().HaveCount(5);
        result.Value.HasPreviousPage.Should().BeTrue();
        result.Value.HasNextPage.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_LastPage_ReturnsRemainingItems()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        using var db = TestDbContextFactory.Create(dbName: dbName);
        await SeedProjects(db, 7);
        var handler = new ListProjectsHandler(db);
        var query = new ListProjectsQuery() { Page = 2, PageSize = 5 };

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.Value!.Items.Should().HaveCount(2);
        result.Value.HasNextPage.Should().BeFalse();
    }

    [Fact]
    public async Task Handle_FilterByStatus_ReturnsOnlyMatchingProjects()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        using var db = TestDbContextFactory.Create(dbName: dbName);
        await SeedProjects(db, 3, status: ProjectStatus.Active, namePrefix: "Active");
        await SeedProjects(db, 2, status: ProjectStatus.Completed, namePrefix: "Done");
        var handler = new ListProjectsHandler(db);
        var query = new ListProjectsQuery(Status: ProjectStatus.Active) { Page = 1, PageSize = 10 };

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.Value!.Items.Should().HaveCount(3);
        result.Value.Items.Should().AllSatisfy(p => p.Status.Should().Be(ProjectStatus.Active));
    }

    [Fact]
    public async Task Handle_FilterByType_ReturnsOnlyMatchingProjects()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        using var db = TestDbContextFactory.Create(dbName: dbName);
        await SeedProjects(db, 2, type: ProjectType.Commercial, namePrefix: "Commercial");
        await SeedProjects(db, 3, type: ProjectType.Residential, namePrefix: "Residential");
        var handler = new ListProjectsHandler(db);
        var query = new ListProjectsQuery(Type: ProjectType.Residential) { Page = 1, PageSize = 10 };

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.Value!.Items.Should().HaveCount(3);
        result.Value.Items.Should().AllSatisfy(p => p.Type.Should().Be(ProjectType.Residential));
    }

    [Fact]
    public async Task Handle_SearchByName_ReturnsMatchingProjects()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        using var db = TestDbContextFactory.Create(dbName: dbName);
        db.Set<Project>().Add(new Project { Name = "Highway Bridge", Number = "PRJ-001", ContractAmount = 100_000m });
        db.Set<Project>().Add(new Project { Name = "Office Tower", Number = "PRJ-002", ContractAmount = 200_000m });
        db.Set<Project>().Add(new Project { Name = "Highway Overpass", Number = "PRJ-003", ContractAmount = 300_000m });
        await db.SaveChangesAsync();
        var handler = new ListProjectsHandler(db);
        var query = new ListProjectsQuery(Search: "highway") { Page = 1, PageSize = 10 };

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.Value!.Items.Should().HaveCount(2);
        result.Value.Items.Should().AllSatisfy(p => p.Name.Should().ContainEquivalentOf("highway"));
    }

    [Fact]
    public async Task Handle_SearchByClientName_ReturnsMatchingProjects()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        using var db = TestDbContextFactory.Create(dbName: dbName);
        db.Set<Project>().Add(new Project { Name = "P1", Number = "PRJ-001", ClientName = "Acme Corp", ContractAmount = 100_000m });
        db.Set<Project>().Add(new Project { Name = "P2", Number = "PRJ-002", ClientName = "Beta Inc", ContractAmount = 200_000m });
        await db.SaveChangesAsync();
        var handler = new ListProjectsHandler(db);
        var query = new ListProjectsQuery(Search: "acme") { Page = 1, PageSize = 10 };

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.Value!.Items.Should().HaveCount(1);
        result.Value.Items[0].ClientName.Should().Be("Acme Corp");
    }

    [Fact]
    public async Task Handle_EmptyDatabase_ReturnsEmptyPage()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new ListProjectsHandler(db);
        var query = new ListProjectsQuery() { Page = 1, PageSize = 10 };

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().BeEmpty();
        result.Value.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task Handle_OrdersByCreatedAtDescending()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        using var db = TestDbContextFactory.Create(dbName: dbName);
        var baseTime = DateTime.UtcNow.Date; // Use date only to avoid precision issues
        var p1 = new Project { Name = "First", Number = "PRJ-001", CreatedAt = baseTime.AddDays(-2), ContractAmount = 0 };
        var p2 = new Project { Name = "Second", Number = "PRJ-002", CreatedAt = baseTime.AddDays(-1), ContractAmount = 0 };
        var p3 = new Project { Name = "Third", Number = "PRJ-003", CreatedAt = baseTime, ContractAmount = 0 };
        db.Set<Project>().AddRange(p1, p2, p3);
        await db.SaveChangesAsync();
        var handler = new ListProjectsHandler(db);
        var query = new ListProjectsQuery() { Page = 1, PageSize = 10 };

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert - most recent first
        result.Value!.Items[0].Name.Should().Be("Third");
        result.Value.Items[1].Name.Should().Be("Second");
        result.Value.Items[2].Name.Should().Be("First");
    }
}
