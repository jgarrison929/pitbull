using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Bids.Domain;
using Pitbull.Bids.Features.ConvertBidToProject;
using Pitbull.Projects.Domain;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class ConvertBidToProjectHandlerTests
{
    private static Bid CreateWonBid(string name = "Won Bid", decimal value = 500_000m)
    {
        return new Bid
        {
            Name = name,
            Number = "BID-WON-001",
            Status = BidStatus.Won,
            EstimatedValue = value,
            Description = "A won bid ready for conversion"
        };
    }

    [Fact]
    public async Task Handle_WonBid_ConvertsToProjectSuccessfully()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        using var db = TestDbContextFactory.Create(dbName: dbName);
        var bid = CreateWonBid();
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();

        var handler = new ConvertBidToProjectHandler(db);
        var command = new ConvertBidToProjectCommand(bid.Id, "PRJ-2026-001");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.BidId.Should().Be(bid.Id);
        result.Value.ProjectName.Should().Be("Won Bid");
        result.Value.ProjectNumber.Should().Be("PRJ-2026-001");
        result.Value.ProjectId.Should().NotBeEmpty();
    }

    [Fact]
    public async Task Handle_WonBid_CreatesProjectWithCorrectFields()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        using var db = TestDbContextFactory.Create(dbName: dbName);
        var bid = CreateWonBid("Big Bridge Project", 1_200_000m);
        bid.Description = "Bridge over troubled water";
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();

        var handler = new ConvertBidToProjectHandler(db);
        var command = new ConvertBidToProjectCommand(bid.Id, "PRJ-BRIDGE-001");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        var project = await db.Set<Project>().FirstOrDefaultAsync(p => p.Id == result.Value!.ProjectId);
        project.Should().NotBeNull();
        project!.Name.Should().Be("Big Bridge Project");
        project.Number.Should().Be("PRJ-BRIDGE-001");
        project.Description.Should().Be("Bridge over troubled water");
        project.Status.Should().Be(ProjectStatus.PreConstruction);
        project.Type.Should().Be(ProjectType.Commercial);
        project.ContractAmount.Should().Be(1_200_000m);
        project.SourceBidId.Should().Be(bid.Id);
    }

    [Fact]
    public async Task Handle_WonBid_LinksBidToProject()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        using var db = TestDbContextFactory.Create(dbName: dbName);
        var bid = CreateWonBid();
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();

        var handler = new ConvertBidToProjectHandler(db);
        var command = new ConvertBidToProjectCommand(bid.Id, "PRJ-LINK-001");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        var updatedBid = await db.Set<Bid>().FirstAsync(b => b.Id == bid.Id);
        updatedBid.ProjectId.Should().Be(result.Value!.ProjectId);
    }

    [Fact]
    public async Task Handle_BidNotFound_ReturnsNotFoundFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new ConvertBidToProjectHandler(db);
        var command = new ConvertBidToProjectCommand(Guid.NewGuid(), "PRJ-NOPE-001");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
        result.Error.Should().Contain("not found");
    }

    [Fact]
    public async Task Handle_DraftBid_ReturnsInvalidStatusFailure()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        using var db = TestDbContextFactory.Create(dbName: dbName);
        var bid = new Bid
        {
            Name = "Draft Bid",
            Number = "BID-DRAFT-001",
            Status = BidStatus.Draft,
            EstimatedValue = 100_000m
        };
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();

        var handler = new ConvertBidToProjectHandler(db);
        var command = new ConvertBidToProjectCommand(bid.Id, "PRJ-FAIL-001");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
        result.Error.Should().Contain("won bids");
    }

    [Fact]
    public async Task Handle_LostBid_ReturnsInvalidStatusFailure()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        using var db = TestDbContextFactory.Create(dbName: dbName);
        var bid = new Bid
        {
            Name = "Lost Bid",
            Number = "BID-LOST-001",
            Status = BidStatus.Lost,
            EstimatedValue = 100_000m
        };
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();

        var handler = new ConvertBidToProjectHandler(db);
        var command = new ConvertBidToProjectCommand(bid.Id, "PRJ-FAIL-002");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task Handle_AlreadyConvertedBid_ReturnsAlreadyConvertedFailure()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        using var db = TestDbContextFactory.Create(dbName: dbName);
        var bid = new Bid
        {
            Name = "Already Converted",
            Number = "BID-CONV-001",
            Status = BidStatus.Won,
            EstimatedValue = 100_000m,
            ProjectId = Guid.NewGuid() // Already linked to a project
        };
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();

        var handler = new ConvertBidToProjectHandler(db);
        var command = new ConvertBidToProjectCommand(bid.Id, "PRJ-DUP-001");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("ALREADY_CONVERTED");
        result.Error.Should().Contain("already been converted");
    }

    [Fact]
    public async Task Handle_SubmittedBid_ReturnsInvalidStatusFailure()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        using var db = TestDbContextFactory.Create(dbName: dbName);
        var bid = new Bid
        {
            Name = "Submitted Bid",
            Number = "BID-SUB-001",
            Status = BidStatus.Submitted,
            EstimatedValue = 100_000m
        };
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();

        var handler = new ConvertBidToProjectHandler(db);
        var command = new ConvertBidToProjectCommand(bid.Id, "PRJ-FAIL-003");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }
}
