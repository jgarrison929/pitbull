using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Bids.Domain;
using Pitbull.Bids.Features.DeleteBid;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class DeleteBidHandlerTests
{
    [Fact]
    public async Task Handle_ValidBid_SoftDeletesSuccessfully()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        using var db = TestDbContextFactory.Create(dbName: dbName);
        var bid = new Bid
        {
            Name = "Test Bid",
            Number = "BID-001",
            Status = BidStatus.Draft,
            EstimatedValue = 50000,
            BidDate = DateTime.UtcNow.AddDays(7),
            DueDate = DateTime.UtcNow.AddDays(14),
            Owner = "Test Owner",
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();
        
        var handler = new DeleteBidHandler(db);
        var command = new DeleteBidCommand(bid.Id);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeTrue();
        
        // Verify bid is soft deleted
        var deletedBid = await db.Set<Bid>().IgnoreQueryFilters()
            .FirstOrDefaultAsync(b => b.Id == bid.Id);
        deletedBid.Should().NotBeNull();
        deletedBid!.IsDeleted.Should().BeTrue();
        deletedBid.DeletedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task Handle_NonExistentBid_ReturnsNotFoundFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new DeleteBidHandler(db);
        var command = new DeleteBidCommand(Guid.NewGuid());

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
        result.Error.Should().Be("Bid not found");
    }

    [Fact]
    public async Task Handle_AlreadyDeletedBid_ReturnsNotFoundFailure()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        using var db = TestDbContextFactory.Create(dbName: dbName);
        var bid = new Bid
        {
            Name = "Test Bid",
            Number = "BID-001",
            Status = BidStatus.Draft,
            EstimatedValue = 50000,
            BidDate = DateTime.UtcNow.AddDays(7),
            DueDate = DateTime.UtcNow.AddDays(14),
            Owner = "Test Owner",
            IsDeleted = true,
            DeletedAt = DateTime.UtcNow.AddDays(-1),
            CreatedAt = DateTime.UtcNow.AddDays(-2)
        };
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();
        
        var handler = new DeleteBidHandler(db);
        var command = new DeleteBidCommand(bid.Id);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
        result.Error.Should().Be("Bid not found");
    }
}