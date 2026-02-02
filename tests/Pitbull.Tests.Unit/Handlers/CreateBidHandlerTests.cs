using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Bids.Domain;
using Pitbull.Bids.Features.CreateBid;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class CreateBidHandlerTests
{
    [Fact]
    public async Task Handle_ValidCommand_CreatesBidAndReturnsDto()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateBidHandler(db);
        var command = new CreateBidCommand(
            Name: "Highway Overpass Bid",
            Number: "BID-2026-001",
            EstimatedValue: 750_000m,
            BidDate: new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc),
            DueDate: new DateTime(2026, 3, 15, 0, 0, 0, DateTimeKind.Utc),
            Owner: "Josh Garrison",
            Description: "Overpass reconstruction bid",
            Items: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Name.Should().Be("Highway Overpass Bid");
        result.Value.Number.Should().Be("BID-2026-001");
        result.Value.Status.Should().Be(BidStatus.Draft);
        result.Value.EstimatedValue.Should().Be(750_000m);
        result.Value.Owner.Should().Be("Josh Garrison");
        result.Value.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_WithLineItems_CreatesItemsAndCalculatesTotalCost()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateBidHandler(db);
        var command = new CreateBidCommand(
            Name: "Office Renovation",
            Number: "BID-2026-002",
            EstimatedValue: 200_000m,
            BidDate: null,
            DueDate: null,
            Owner: null,
            Description: null,
            Items: new List<CreateBidItemDto>
            {
                new("Concrete Work", BidItemCategory.Material, 100m, 50m),
                new("Framing Labor", BidItemCategory.Labor, 200m, 75m),
                new("Electrical Sub", BidItemCategory.Subcontractor, 1m, 25_000m)
            }
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(3);
        
        var concrete = result.Value.Items.First(i => i.Description == "Concrete Work");
        concrete.Category.Should().Be(BidItemCategory.Material);
        concrete.Quantity.Should().Be(100m);
        concrete.UnitCost.Should().Be(50m);
        concrete.TotalCost.Should().Be(5_000m); // 100 * 50

        var electrical = result.Value.Items.First(i => i.Description == "Electrical Sub");
        electrical.TotalCost.Should().Be(25_000m); // 1 * 25000
    }

    [Fact]
    public async Task Handle_PersistsBidToDatabase()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateBidHandler(db);
        var command = new CreateBidCommand(
            Name: "Persisted Bid",
            Number: "BID-PER-001",
            EstimatedValue: 100_000m,
            BidDate: null, DueDate: null, Owner: null, Description: null,
            Items: null
        );

        // Act
        await handler.Handle(command, CancellationToken.None);

        // Assert
        var saved = await db.Set<Bid>().FirstOrDefaultAsync();
        saved.Should().NotBeNull();
        saved!.Name.Should().Be("Persisted Bid");
        saved.TenantId.Should().Be(TestDbContextFactory.TestTenantId);
    }

    [Fact]
    public async Task Handle_EmptyItemsList_CreatesNoBidItems()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateBidHandler(db);
        var command = new CreateBidCommand(
            Name: "No Items Bid",
            Number: "BID-EMPTY-001",
            EstimatedValue: 50_000m,
            BidDate: null, DueDate: null, Owner: null, Description: null,
            Items: new List<CreateBidItemDto>()
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_DefaultsStatusToDraft()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateBidHandler(db);
        var command = new CreateBidCommand(
            Name: "Status Test Bid",
            Number: "BID-ST-001",
            EstimatedValue: 0m,
            BidDate: null, DueDate: null, Owner: null, Description: null,
            Items: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Value!.Status.Should().Be(BidStatus.Draft);
        var saved = await db.Set<Bid>().FirstAsync();
        saved.Status.Should().Be(BidStatus.Draft);
    }

    [Fact]
    public async Task Handle_SetsTenantIdFromContext()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateBidHandler(db);
        var command = new CreateBidCommand(
            Name: "Tenant Test Bid",
            Number: "BID-TEN-001",
            EstimatedValue: 100m,
            BidDate: null, DueDate: null, Owner: null, Description: null,
            Items: null
        );

        // Act
        await handler.Handle(command, CancellationToken.None);

        // Assert
        var bid = await db.Set<Bid>().FirstAsync();
        bid.TenantId.Should().Be(TestDbContextFactory.TestTenantId);
    }
}
