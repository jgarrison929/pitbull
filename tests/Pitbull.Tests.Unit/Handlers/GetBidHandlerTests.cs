using FluentAssertions;
using Pitbull.Bids.Domain;
using Pitbull.Bids.Features.GetBid;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public sealed class GetBidHandlerTests
{
    [Fact]
    public async Task Handle_WithExistingBid_ReturnsBidDto()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            Name = "Test Bid",
            Number = "BID-001",
            Status = BidStatus.Submitted,
            Owner = "Test Owner",
            EstimatedValue = 500000m
        };
        db.Add(bid);
        await db.SaveChangesAsync();

        var handler = new GetBidHandler(db);
        var query = new GetBidQuery(bid.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Id.Should().Be(bid.Id);
        result.Value.Name.Should().Be("Test Bid");
        result.Value.Number.Should().Be("BID-001");
    }

    [Fact]
    public async Task Handle_WithNonExistentBid_ReturnsNotFoundError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new GetBidHandler(db);
        var query = new GetBidQuery(Guid.NewGuid());

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
        result.Error.Should().Contain("not found");
    }

    [Fact]
    public async Task Handle_WithBidItems_IncludesItems()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            Name = "Bid With Items",
            Number = "BID-ITEMS-001",
            Status = BidStatus.Draft,
            EstimatedValue = 100000m
        };
        
        bid.Items.Add(new BidItem
        {
            Id = Guid.NewGuid(),
            BidId = bid.Id,
            Description = "Foundation Work",
            Quantity = 1,
            UnitCost = 50000m,
            TotalCost = 50000m
        });
        
        bid.Items.Add(new BidItem
        {
            Id = Guid.NewGuid(),
            BidId = bid.Id,
            Description = "Framing",
            Quantity = 1,
            UnitCost = 50000m,
            TotalCost = 50000m
        });

        db.Add(bid);
        await db.SaveChangesAsync();

        var handler = new GetBidHandler(db);
        var query = new GetBidQuery(bid.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(2);
        result.Value.Items.Should().Contain(i => i.Description == "Foundation Work");
        result.Value.Items.Should().Contain(i => i.Description == "Framing");
    }

    [Fact]
    public async Task Handle_ReturnsBidStatus()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            Name = "Won Bid",
            Number = "BID-WON-001",
            Status = BidStatus.Won,
            EstimatedValue = 750000m
        };
        db.Add(bid);
        await db.SaveChangesAsync();

        var handler = new GetBidHandler(db);
        var query = new GetBidQuery(bid.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(BidStatus.Won);
    }

    [Fact]
    public void GetBidQuery_CanBeCreated()
    {
        // Arrange
        var bidId = Guid.NewGuid();

        // Act
        var query = new GetBidQuery(bidId);

        // Assert
        query.Id.Should().Be(bidId);
    }
}
