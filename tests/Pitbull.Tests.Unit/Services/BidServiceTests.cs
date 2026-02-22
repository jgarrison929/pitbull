using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.Extensions.Logging;
using Moq;
using Pitbull.Bids.Domain;
using Pitbull.Bids.Features.ConvertBidToProject;
using Pitbull.Bids.Features.CreateBid;
using Pitbull.Bids.Features.ListBids;
using Pitbull.Bids.Features.UpdateBid;
using Pitbull.Bids.Services;
using Pitbull.Contracts.Domain;
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
        result.ErrorCode.Should().Be("INVALID_STATUS");
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

    [Fact]
    public async Task ConvertToProjectAsync_AlreadyConverted_ReturnsError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            Name = "Already Converted Bid",
            Number = "BID-AC-001",
            Status = BidStatus.Won,
            EstimatedValue = 300_000m,
            ProjectId = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var command = new ConvertBidToProjectCommand(bid.Id, "PRJ-002");

        // Act
        var result = await service.ConvertToProjectAsync(command);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("ALREADY_CONVERTED");
    }

    [Fact]
    public async Task ConvertToProjectAsync_DuplicateProjectNumber_ReturnsError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var existingProject = new Project
        {
            Id = Guid.NewGuid(),
            Name = "Existing Project",
            Number = "PRJ-DUPE",
            Status = ProjectStatus.Active,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Project>().Add(existingProject);

        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            Name = "Bid to Convert",
            Number = "BID-DUPE-001",
            Status = BidStatus.Won,
            EstimatedValue = 200_000m,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var command = new ConvertBidToProjectCommand(bid.Id, "PRJ-DUPE");

        // Act
        var result = await service.ConvertToProjectAsync(command);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("DUPLICATE_NUMBER");
    }

    [Fact]
    public async Task ConvertToProjectAsync_WithCustomProjectName_UsesOverride()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            Name = "Original Bid Name",
            Number = "BID-CUSTOM-001",
            Status = BidStatus.Won,
            EstimatedValue = 400_000m,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var command = new ConvertBidToProjectCommand(
            BidId: bid.Id,
            ProjectNumber: "PRJ-CUSTOM",
            ProjectName: "Custom Project Name"
        );

        // Act
        var result = await service.ConvertToProjectAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.ProjectName.Should().Be("Custom Project Name");

        var project = await db.Set<Project>().FindAsync(result.Value.ProjectId);
        project!.Name.Should().Be("Custom Project Name");
    }

    [Fact]
    public async Task ConvertToProjectAsync_WithBudget_CreatesProjectBudget()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            Name = "Budget Bid",
            Number = "BID-BUD-001",
            Status = BidStatus.Won,
            EstimatedValue = 750_000m,
            Items = new List<BidItem>
            {
                new() { Id = Guid.NewGuid(), Description = "Concrete", Category = BidItemCategory.Material, Quantity = 100, UnitCost = 150, TotalCost = 15_000m },
                new() { Id = Guid.NewGuid(), Description = "Labor", Category = BidItemCategory.Labor, Quantity = 200, UnitCost = 75, TotalCost = 15_000m }
            },
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var command = new ConvertBidToProjectCommand(
            BidId: bid.Id,
            ProjectNumber: "PRJ-BUD",
            CreateBudget: true
        );

        // Act
        var result = await service.ConvertToProjectAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.BudgetId.Should().NotBeNull();

        var budget = await db.Set<ProjectBudget>().FindAsync(result.Value.BudgetId);
        budget.Should().NotBeNull();
        budget!.OriginalContractAmount.Should().Be(750_000m);
        budget.TotalBudget.Should().Be(750_000m);
    }

    [Fact]
    public async Task ConvertToProjectAsync_WithSubcontracts_CreatesSubcontracts()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            Name = "Subcontract Bid",
            Number = "BID-SC-001",
            Status = BidStatus.Won,
            EstimatedValue = 1_000_000m,
            Items = new List<BidItem>
            {
                new() { Id = Guid.NewGuid(), Description = "Electrical Sub", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 200_000, TotalCost = 200_000m },
                new() { Id = Guid.NewGuid(), Description = "Plumbing Sub", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 150_000, TotalCost = 150_000m },
                new() { Id = Guid.NewGuid(), Description = "Concrete Material", Category = BidItemCategory.Material, Quantity = 500, UnitCost = 100, TotalCost = 50_000m }
            },
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var command = new ConvertBidToProjectCommand(
            BidId: bid.Id,
            ProjectNumber: "PRJ-SC",
            CreateSubcontracts: true
        );

        // Act
        var result = await service.ConvertToProjectAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.SubcontractsCreated.Should().Be(2);

        var subcontracts = db.Set<Subcontract>().Where(s => s.ProjectId == result.Value.ProjectId).ToList();
        subcontracts.Should().HaveCount(2);
        subcontracts.Should().Contain(s => s.SubcontractorName == "Electrical Sub");
        subcontracts.Should().Contain(s => s.SubcontractorName == "Plumbing Sub");
        subcontracts.All(s => s.Status == SubcontractStatus.Draft).Should().BeTrue();
    }

    [Fact]
    public async Task ConvertToProjectAsync_WithLocationOverrides_SetsProjectLocation()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            Name = "Location Bid",
            Number = "BID-LOC-001",
            Status = BidStatus.Won,
            EstimatedValue = 600_000m,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var command = new ConvertBidToProjectCommand(
            BidId: bid.Id,
            ProjectNumber: "PRJ-LOC",
            Address: "123 Main St",
            City: "Springfield",
            State: "IL",
            ZipCode: "62701"
        );

        // Act
        var result = await service.ConvertToProjectAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var project = await db.Set<Project>().FindAsync(result.Value!.ProjectId);
        project!.Address.Should().Be("123 Main St");
        project.City.Should().Be("Springfield");
        project.State.Should().Be("IL");
        project.ZipCode.Should().Be("62701");
    }

    [Fact]
    public async Task ConvertToProjectAsync_LinksBidToProject()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            Name = "Link Test Bid",
            Number = "BID-LINK-001",
            Status = BidStatus.Won,
            EstimatedValue = 350_000m,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var command = new ConvertBidToProjectCommand(bid.Id, "PRJ-LINK");

        // Act
        var result = await service.ConvertToProjectAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();

        var updatedBid = await db.Set<Bid>().FindAsync(bid.Id);
        updatedBid!.ProjectId.Should().Be(result.Value!.ProjectId);
    }

    [Fact]
    public async Task ConvertToProjectAsync_SetsBidStatusToConverted()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            Name = "Status Change Bid",
            Number = "BID-CONV-001",
            Status = BidStatus.Won,
            EstimatedValue = 450_000m,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var command = new ConvertBidToProjectCommand(bid.Id, "PRJ-CONV");

        // Act
        var result = await service.ConvertToProjectAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();

        var updatedBid = await db.Set<Bid>().FindAsync(bid.Id);
        updatedBid!.Status.Should().Be(BidStatus.Converted);
    }

    [Fact]
    public async Task ConvertToProjectAsync_ConvertedBid_ReturnsInvalidStatus()
    {
        // Arrange — bid already converted (status is Converted, not Won)
        using var db = TestDbContextFactory.Create();
        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            Name = "Re-Convert Attempt",
            Number = "BID-RECONV-001",
            Status = BidStatus.Converted,
            EstimatedValue = 500_000m,
            ProjectId = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var command = new ConvertBidToProjectCommand(bid.Id, "PRJ-RECONV");

        // Act
        var result = await service.ConvertToProjectAsync(command);

        // Assert — should fail because status is Converted, not Won
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task ConvertToProjectAsync_SetsProjectStatusToPreConstruction()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            Name = "Status Test Bid",
            Number = "BID-STATUS-001",
            Status = BidStatus.Won,
            EstimatedValue = 250_000m,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var command = new ConvertBidToProjectCommand(bid.Id, "PRJ-STATUS");

        // Act
        var result = await service.ConvertToProjectAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var project = await db.Set<Project>().FindAsync(result.Value!.ProjectId);
        project!.Status.Should().Be(ProjectStatus.PreConstruction);
    }

    [Fact]
    public async Task ConvertToProjectAsync_SetsOriginalBudgetFromBidValue()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            Name = "Budget Value Bid",
            Number = "BID-BV-001",
            Status = BidStatus.Won,
            EstimatedValue = 1_250_000m,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var command = new ConvertBidToProjectCommand(bid.Id, "PRJ-BV");

        // Act
        var result = await service.ConvertToProjectAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var project = await db.Set<Project>().FindAsync(result.Value!.ProjectId);
        project!.OriginalBudget.Should().Be(1_250_000m);
        project.ContractAmount.Should().Be(1_250_000m);
    }

    #endregion

    #region GetConversionPreviewAsync

    [Fact]
    public async Task GetConversionPreviewAsync_WonBid_ReturnsPreview()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            Name = "Preview Bid",
            Number = "BID-PRV-001",
            Status = BidStatus.Won,
            EstimatedValue = 500_000m,
            Owner = "John Doe",
            Description = "Preview test",
            Items = new List<BidItem>
            {
                new() { Id = Guid.NewGuid(), Description = "Concrete", Category = BidItemCategory.Material, Quantity = 100, UnitCost = 50, TotalCost = 5_000m },
                new() { Id = Guid.NewGuid(), Description = "Electrician", Category = BidItemCategory.Subcontractor, Quantity = 1, UnitCost = 80_000, TotalCost = 80_000m }
            },
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();

        var service = CreateService(db);

        // Act
        var result = await service.GetConversionPreviewAsync(bid.Id);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.BidId.Should().Be(bid.Id);
        result.Value.BidName.Should().Be("Preview Bid");
        result.Value.EstimatedValue.Should().Be(500_000m);
        result.Value.Items.Should().HaveCount(2);
        result.Value.Items[0].SuggestedCostCode.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task GetConversionPreviewAsync_NonWonBid_ReturnsError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            Name = "Not Won",
            Number = "BID-NW-001",
            Status = BidStatus.Submitted,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();

        var service = CreateService(db);

        // Act
        var result = await service.GetConversionPreviewAsync(bid.Id);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task GetConversionPreviewAsync_AlreadyConverted_ReturnsError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var bid = new Bid
        {
            Id = Guid.NewGuid(),
            Name = "Already Converted Preview",
            Number = "BID-ACP-001",
            Status = BidStatus.Won,
            ProjectId = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync();

        var service = CreateService(db);

        // Act
        var result = await service.GetConversionPreviewAsync(bid.Id);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("ALREADY_CONVERTED");
    }

    [Fact]
    public async Task GetConversionPreviewAsync_NonExistentBid_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        // Act
        var result = await service.GetConversionPreviewAsync(Guid.NewGuid());

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion
}
