using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.Extensions.Logging;
using Moq;
using Pitbull.Bids.Domain;
using Pitbull.Bids.Features.CreateBid;
using Pitbull.Bids.Features.ConvertBidToProject;
using Pitbull.Bids.Features.ListBids;
using Pitbull.Bids.Features.UpdateBid;
using Pitbull.Bids.Services;
using Pitbull.Projects.Domain;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Services;

public class BidServiceTests
{
    private readonly Mock<IValidator<CreateBidCommand>> _createValidatorMock;
    private readonly Mock<IValidator<UpdateBidCommand>> _updateValidatorMock;
    private readonly Mock<ILogger<BidService>> _loggerMock;

    public BidServiceTests()
    {
        _createValidatorMock = new Mock<IValidator<CreateBidCommand>>();
        _updateValidatorMock = new Mock<IValidator<UpdateBidCommand>>();
        _loggerMock = new Mock<ILogger<BidService>>();

        // Default to valid
        _createValidatorMock
            .Setup(v => v.ValidateAsync(It.IsAny<CreateBidCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ValidationResult());
        _updateValidatorMock
            .Setup(v => v.ValidateAsync(It.IsAny<UpdateBidCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ValidationResult());
    }

    private BidService CreateService(Pitbull.Core.Data.PitbullDbContext db) =>
        new(db, _createValidatorMock.Object, _updateValidatorMock.Object, _loggerMock.Object);

    #region GetBidAsync

    [Fact]
    public async Task GetBidAsync_ExistingBid_ReturnsBidDto()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            Name = "Test Bid",
            Number = "BID-001",
            Status = BidStatus.Draft,
            EstimatedValue = 100_000m,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();

        var service = CreateService(db);

        // Act
        var result = await service.GetBidAsync(bid.Id);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Id.Should().Be(bid.Id);
        result.Value.Name.Should().Be("Test Bid");
        result.Value.Number.Should().Be("BID-001");
    }

    [Fact]
    public async Task GetBidAsync_NonExistentBid_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        // Act
        var result = await service.GetBidAsync(Guid.NewGuid());

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task GetBidAsync_IncludesItems()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            Name = "Bid With Items",
            Number = "BID-002",
            Status = BidStatus.Draft,
            Items = new List<BidItem>
            {
                new() { Id = Guid.NewGuid(), Description = "Item 1", Quantity = 10, UnitCost = 100 },
                new() { Id = Guid.NewGuid(), Description = "Item 2", Quantity = 5, UnitCost = 200 }
            },
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();

        var service = CreateService(db);

        // Act
        var result = await service.GetBidAsync(bid.Id);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(2);
    }

    #endregion

    #region GetBidsAsync

    [Fact]
    public async Task GetBidsAsync_ReturnsPagedResults()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        for (int i = 0; i < 15; i++)
        {
            db.Set<Bid>().Add(new Bid
            {
                Id = Guid.NewGuid(),
                Name = $"Bid {i}",
                Number = $"BID-{i:D3}",
                Status = BidStatus.Draft,
                CreatedAt = DateTime.UtcNow.AddMinutes(-i)
            });
        }
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var query = new ListBidsQuery(Status: null, Search: null) { Page = 1, PageSize = 10 };

        // Act
        var result = await service.GetBidsAsync(query);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(10);
        result.Value.TotalCount.Should().Be(15);
        result.Value.TotalPages.Should().Be(2);
    }

    [Fact]
    public async Task GetBidsAsync_FiltersByStatus()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        db.Set<Bid>().Add(new Bid { Id = Guid.NewGuid(), Name = "Draft Bid", Number = "B1", Status = BidStatus.Draft, CreatedAt = DateTime.UtcNow });
        db.Set<Bid>().Add(new Bid { Id = Guid.NewGuid(), Name = "Submitted Bid", Number = "B2", Status = BidStatus.Submitted, CreatedAt = DateTime.UtcNow });
        db.Set<Bid>().Add(new Bid { Id = Guid.NewGuid(), Name = "Won Bid", Number = "B3", Status = BidStatus.Won, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var query = new ListBidsQuery(Status: BidStatus.Submitted, Search: null) { Page = 1, PageSize = 10 };

        // Act
        var result = await service.GetBidsAsync(query);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(1);
        result.Value.Items[0].Name.Should().Be("Submitted Bid");
    }

    [Fact]
    public async Task GetBidsAsync_SearchByNameOrNumber()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        db.Set<Bid>().Add(new Bid { Id = Guid.NewGuid(), Name = "Highway Project", Number = "BID-HWY-001", Status = BidStatus.Draft, CreatedAt = DateTime.UtcNow });
        db.Set<Bid>().Add(new Bid { Id = Guid.NewGuid(), Name = "Office Building", Number = "BID-OFF-001", Status = BidStatus.Draft, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var query = new ListBidsQuery(Status: null, Search: "highway") { Page = 1, PageSize = 10 };

        // Act
        var result = await service.GetBidsAsync(query);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(1);
        result.Value.Items[0].Name.Should().Be("Highway Project");
    }

    #endregion

    #region CreateBidAsync

    [Fact]
    public async Task CreateBidAsync_ValidCommand_CreatesBid()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var command = new CreateBidCommand(
            Name: "New Bid",
            Number: "BID-NEW-001",
            EstimatedValue: 250_000m,
            BidDate: DateTime.UtcNow.AddDays(7),
            DueDate: DateTime.UtcNow.AddDays(14),
            Owner: "John Doe",
            Description: "A new bid",
            Items: null
        );

        // Act
        var result = await service.CreateBidAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Name.Should().Be("New Bid");
        result.Value.Status.Should().Be(BidStatus.Draft);
        result.Value.EstimatedValue.Should().Be(250_000m);

        // Verify persisted
        var saved = await db.Set<Bid>().FindAsync(result.Value.Id);
        saved.Should().NotBeNull();
    }

    [Fact]
    public async Task CreateBidAsync_ValidationFails_ReturnsError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        _createValidatorMock
            .Setup(v => v.ValidateAsync(It.IsAny<CreateBidCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ValidationResult(new[] { new ValidationFailure("Name", "Name is required") }));

        var service = CreateService(db);
        var command = new CreateBidCommand("", "BID-001", 0, null, null, null, null, null);

        // Act
        var result = await service.CreateBidAsync(command);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("Name is required");
    }

    #endregion

    #region UpdateBidAsync

    [Fact]
    public async Task UpdateBidAsync_ValidCommand_UpdatesBid()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            Name = "Original Name",
            Number = "BID-001",
            Status = BidStatus.Draft,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var command = new UpdateBidCommand(
            Id: bid.Id,
            Name: "Updated Name",
            Number: "BID-001-REV",
            Status: BidStatus.Submitted,
            EstimatedValue: 300_000m,
            BidDate: DateTime.UtcNow,
            DueDate: DateTime.UtcNow.AddDays(7),
            Owner: "Jane Doe",
            Description: "Updated description",
            Items: null
        );

        // Act
        var result = await service.UpdateBidAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Name.Should().Be("Updated Name");
        result.Value.Status.Should().Be(BidStatus.Submitted);
    }

    [Fact]
    public async Task UpdateBidAsync_NonExistentBid_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var command = new UpdateBidCommand(
            Id: Guid.NewGuid(),
            Name: "Name",
            Number: "NUM",
            Status: BidStatus.Draft,
            EstimatedValue: 0,
            BidDate: null,
            DueDate: null,
            Owner: null,
            Description: null,
            Items: null
        );

        // Act
        var result = await service.UpdateBidAsync(command);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region DeleteBidAsync

    [Fact]
    public async Task DeleteBidAsync_ExistingBid_SoftDeletes()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            Name = "To Delete",
            Number = "BID-DEL-001",
            Status = BidStatus.Draft,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();

        var service = CreateService(db);

        // Act
        var result = await service.DeleteBidAsync(bid.Id);

        // Assert
        result.IsSuccess.Should().BeTrue();

        var deleted = await db.Set<Bid>().FindAsync(bid.Id);
        deleted!.IsDeleted.Should().BeTrue();
        deleted.DeletedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task DeleteBidAsync_NonExistentBid_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        // Act
        var result = await service.DeleteBidAsync(Guid.NewGuid());

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task DeleteBidAsync_AlreadyDeleted_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            Name = "Already Deleted",
            Number = "BID-AD-001",
            Status = BidStatus.Draft,
            IsDeleted = true,
            DeletedAt = DateTime.UtcNow.AddDays(-1),
            CreatedAt = DateTime.UtcNow.AddDays(-2)
        };
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();

        var service = CreateService(db);

        // Act
        var result = await service.DeleteBidAsync(bid.Id);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region ConvertToProjectAsync

    [Fact]
    public async Task ConvertToProjectAsync_WonBid_CreatesProject()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            Name = "Won Bid",
            Number = "BID-WON-001",
            Status = BidStatus.Won,
            EstimatedValue = 500_000m,
            Description = "A winning bid",
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var command = new ConvertBidToProjectCommand(bid.Id, "PRJ-001");

        // Act
        var result = await service.ConvertToProjectAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.BidId.Should().Be(bid.Id);
        result.Value.ProjectName.Should().Be("Won Bid");
        result.Value.ProjectNumber.Should().Be("PRJ-001");

        // Verify project was created
        var project = await db.Set<Project>().FindAsync(result.Value.ProjectId);
        project.Should().NotBeNull();
        project!.SourceBidId.Should().Be(bid.Id);
        project.ContractAmount.Should().Be(500_000m);
    }

    [Fact]
    public async Task ConvertToProjectAsync_NonWonBid_ReturnsError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            Name = "Draft Bid",
            Number = "BID-DRAFT-001",
            Status = BidStatus.Draft,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var command = new ConvertBidToProjectCommand(bid.Id, "PRJ-001");

        // Act
        var result = await service.ConvertToProjectAsync(command);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATE");
        result.Error.Should().Contain("Only won bids");
    }

    [Fact]
    public async Task ConvertToProjectAsync_NonExistentBid_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var command = new ConvertBidToProjectCommand(Guid.NewGuid(), "PRJ-001");

        // Act
        var result = await service.ConvertToProjectAsync(command);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion
}
