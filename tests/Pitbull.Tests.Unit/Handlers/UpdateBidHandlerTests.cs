using FluentAssertions;
using Pitbull.Bids.Domain;
using Pitbull.Bids.Features.UpdateBid;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public sealed class UpdateBidHandlerTests
{
    [Fact]
    public async Task Handle_WithExistingBid_UpdatesBid()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            Name = "Original Name",
            Number = "BID-001",
            Status = BidStatus.Draft,
            EstimatedValue = 100000m
        };
        db.Add(bid);
        await db.SaveChangesAsync();

        var handler = new UpdateBidHandler(db);
        var command = new UpdateBidCommand(
            Id: bid.Id,
            Name: "Updated Name",
            Number: "BID-001-REV",
            Status: BidStatus.Submitted,
            EstimatedValue: 150000m,
            BidDate: new DateTime(2026, 3, 1),
            DueDate: new DateTime(2026, 3, 15),
            Owner: "John Doe",
            Description: "Updated description",
            Items: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Name.Should().Be("Updated Name");
        result.Value.Number.Should().Be("BID-001-REV");
        result.Value.Status.Should().Be(BidStatus.Submitted);
        result.Value.EstimatedValue.Should().Be(150000m);
    }

    [Fact]
    public async Task Handle_WithNonExistentBid_ReturnsNotFoundError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new UpdateBidHandler(db);
        var command = new UpdateBidCommand(
            Id: Guid.NewGuid(),
            Name: "Test",
            Number: "BID-999",
            Status: BidStatus.Draft,
            EstimatedValue: 0,
            BidDate: null,
            DueDate: null,
            Owner: null,
            Description: null,
            Items: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task Handle_CanChangeStatus()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            Name = "Status Test Bid",
            Number = "BID-STATUS-001",
            Status = BidStatus.Submitted,
            EstimatedValue = 200000m
        };
        db.Add(bid);
        await db.SaveChangesAsync();

        var handler = new UpdateBidHandler(db);
        var command = new UpdateBidCommand(
            Id: bid.Id,
            Name: "Status Test Bid",
            Number: "BID-STATUS-001",
            Status: BidStatus.Won,
            EstimatedValue: 200000m,
            BidDate: null,
            DueDate: null,
            Owner: null,
            Description: null,
            Items: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(BidStatus.Won);
    }

    [Fact]
    public void UpdateBidCommand_CanBeCreated()
    {
        // Arrange & Act
        var command = new UpdateBidCommand(
            Id: Guid.NewGuid(),
            Name: "Test",
            Number: "BID-001",
            Status: BidStatus.Draft,
            EstimatedValue: 50000m,
            BidDate: null,
            DueDate: null,
            Owner: null,
            Description: null,
            Items: null
        );

        // Assert
        command.Name.Should().Be("Test");
        command.Number.Should().Be("BID-001");
        command.EstimatedValue.Should().Be(50000m);
    }
}
