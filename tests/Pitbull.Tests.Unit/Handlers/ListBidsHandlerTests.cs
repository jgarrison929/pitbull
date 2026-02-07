using FluentAssertions;
using Pitbull.Bids.Domain;
using Pitbull.Bids.Features.ListBids;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class ListBidsHandlerTests
{
    private static async Task SeedBids(
        Pitbull.Core.Data.PitbullDbContext db, int count,
        BidStatus? status = null, string namePrefix = "Bid")
    {
        for (int i = 1; i <= count; i++)
        {
            db.Set<Bid>().Add(new Bid
            {
                Name = $"{namePrefix} {i}",
                Number = $"BID-{namePrefix}-{i:D3}",
                Status = status ?? BidStatus.Draft,
                EstimatedValue = i * 50_000m
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
        await SeedBids(db, 5);
        var handler = new ListBidsHandler(db);
        var query = new ListBidsQuery() { Page = 1, PageSize = 10 };

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(5);
        result.Value.TotalCount.Should().Be(5);
    }

    [Fact]
    public async Task Handle_PaginatesCorrectly()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        using var db = TestDbContextFactory.Create(dbName: dbName);
        await SeedBids(db, 12);
        var handler = new ListBidsHandler(db);
        var query = new ListBidsQuery() { Page = 1, PageSize = 5 };

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.Value!.Items.Should().HaveCount(5);
        result.Value.TotalCount.Should().Be(12);
        result.Value.TotalPages.Should().Be(3); // ceil(12/5)
        result.Value.HasNextPage.Should().BeTrue();
        result.Value.HasPreviousPage.Should().BeFalse();
    }

    [Fact]
    public async Task Handle_Page3_ReturnsRemainingItems()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        using var db = TestDbContextFactory.Create(dbName: dbName);
        await SeedBids(db, 12);
        var handler = new ListBidsHandler(db);
        var query = new ListBidsQuery() { Page = 3, PageSize = 5 };

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.Value!.Items.Should().HaveCount(2);
        result.Value.HasNextPage.Should().BeFalse();
        result.Value.HasPreviousPage.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_FilterByStatus_ReturnsOnlyMatchingBids()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        using var db = TestDbContextFactory.Create(dbName: dbName);
        await SeedBids(db, 3, status: BidStatus.Draft, namePrefix: "Draft");
        await SeedBids(db, 2, status: BidStatus.Won, namePrefix: "Won");
        await SeedBids(db, 1, status: BidStatus.Lost, namePrefix: "Lost");
        var handler = new ListBidsHandler(db);
        var query = new ListBidsQuery(Status: BidStatus.Won) { Page = 1, PageSize = 10 };

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.Value!.Items.Should().HaveCount(2);
        result.Value.Items.Should().AllSatisfy(b => b.Status.Should().Be(BidStatus.Won));
    }

    [Fact]
    public async Task Handle_SearchByName_ReturnsMatchingBids()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        using var db = TestDbContextFactory.Create(dbName: dbName);
        db.Set<Bid>().Add(new Bid { Name = "Highway Bridge Bid", Number = "BID-001", EstimatedValue = 100_000m });
        db.Set<Bid>().Add(new Bid { Name = "Office Renovation", Number = "BID-002", EstimatedValue = 200_000m });
        db.Set<Bid>().Add(new Bid { Name = "Highway Overpass", Number = "BID-003", EstimatedValue = 300_000m });
        await db.SaveChangesAsync();
        var handler = new ListBidsHandler(db);
        var query = new ListBidsQuery(Search: "highway") { Page = 1, PageSize = 10 };

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.Value!.Items.Should().HaveCount(2);
    }

    [Fact]
    public async Task Handle_SearchByOwner_ReturnsMatchingBids()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        using var db = TestDbContextFactory.Create(dbName: dbName);
        db.Set<Bid>().Add(new Bid { Name = "B1", Number = "BID-001", Owner = "Mike Reynolds", EstimatedValue = 100_000m });
        db.Set<Bid>().Add(new Bid { Name = "B2", Number = "BID-002", Owner = "Mike", EstimatedValue = 200_000m });
        await db.SaveChangesAsync();
        var handler = new ListBidsHandler(db);
        var query = new ListBidsQuery(Search: "demo") { Page = 1, PageSize = 10 };

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.Value!.Items.Should().HaveCount(1);
        result.Value.Items[0].Owner.Should().Be("Demo User");
    }

    [Fact]
    public async Task Handle_IncludesBidItems()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        using var db = TestDbContextFactory.Create(dbName: dbName);
        var bid = new Bid { Name = "With Items", Number = "BID-ITEMS-001", EstimatedValue = 100_000m };
        bid.Items.Add(new BidItem { Description = "Labor", Category = BidItemCategory.Labor, Quantity = 10, UnitCost = 50, TotalCost = 500 });
        bid.Items.Add(new BidItem { Description = "Material", Category = BidItemCategory.Material, Quantity = 5, UnitCost = 100, TotalCost = 500 });
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();
        var handler = new ListBidsHandler(db);
        var query = new ListBidsQuery() { Page = 1, PageSize = 10 };

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.Value!.Items[0].Items.Should().HaveCount(2);
    }

    [Fact]
    public async Task Handle_EmptyDatabase_ReturnsEmptyPage()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new ListBidsHandler(db);
        var query = new ListBidsQuery() { Page = 1, PageSize = 10 };

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
        db.Set<Bid>().Add(new Bid { Name = "Old", Number = "BID-001", CreatedAt = DateTime.UtcNow.AddDays(-2), EstimatedValue = 0 });
        db.Set<Bid>().Add(new Bid { Name = "New", Number = "BID-002", CreatedAt = DateTime.UtcNow, EstimatedValue = 0 });
        await db.SaveChangesAsync();
        var handler = new ListBidsHandler(db);
        var query = new ListBidsQuery() { Page = 1, PageSize = 10 };

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.Value!.Items[0].Name.Should().Be("New");
        result.Value.Items[1].Name.Should().Be("Old");
    }
}
