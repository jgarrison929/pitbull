using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Bids.Domain;
using Pitbull.Bids.Features.ConvertBidToProject;
using Pitbull.Bids.Features.CreateBid;
using Pitbull.Bids.Features.ListBids;
using Pitbull.Bids.Features.Shared;
using Pitbull.Bids.Features.UpdateBid;
using Pitbull.Bids.Services;
using Pitbull.Core.CQRS;

namespace Pitbull.Tests.Unit.Api;

public class BidsControllerTests
{
    private readonly Mock<IBidService> _serviceMock;
    private readonly BidsController _controller;

    private static readonly Guid TestId = Guid.NewGuid();

    public BidsControllerTests()
    {
        _serviceMock = new Mock<IBidService>();
        _controller = new BidsController(_serviceMock.Object);
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
    }

    private static BidDto CreateTestDto(Guid? id = null) => new(
        Id: id ?? TestId,
        Name: "Highway Bridge Estimate",
        Number: "BID-2026-005",
        Status: BidStatus.Draft,
        EstimatedValue: 500_000m,
        BidDate: new DateTime(2026, 2, 15, 0, 0, 0, DateTimeKind.Utc),
        DueDate: new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc),
        Owner: "John Doe",
        Description: "Bridge construction estimate",
        ProjectId: null,
        Items: new List<BidItemDto>
        {
            new(
                Id: Guid.NewGuid(),
                Description: "Concrete work",
                Category: BidItemCategory.Material,
                Quantity: 500,
                UnitCost: 125.00m,
                TotalCost: 62_500m)
        },
        CreatedAt: DateTime.UtcNow
    );

    #region Create

    [Fact]
    public async Task Create_Success_Returns201WithBid()
    {
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.CreateBidAsync(It.IsAny<CreateBidCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var command = new CreateBidCommand(
            Name: "Highway Bridge Estimate",
            Number: "BID-2026-005",
            EstimatedValue: 500_000m,
            BidDate: new DateTime(2026, 2, 15),
            DueDate: new DateTime(2026, 3, 1),
            Owner: "John Doe",
            Description: "Bridge construction estimate",
            Items: null);

        var result = await _controller.Create(command);

        var created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        created.StatusCode.Should().Be(201);
        created.Value.Should().Be(dto);
        created.ActionName.Should().Be("GetById");
    }

    [Fact]
    public async Task Create_ValidationError_Returns400()
    {
        _serviceMock
            .Setup(s => s.CreateBidAsync(It.IsAny<CreateBidCommand>(), default))
            .ReturnsAsync(Result.Failure<BidDto>("Name is required", "VALIDATION_ERROR"));

        var command = new CreateBidCommand(
            Name: "",
            Number: "BID-001",
            EstimatedValue: 0,
            BidDate: null,
            DueDate: null,
            Owner: null,
            Description: null,
            Items: null);

        var result = await _controller.Create(command);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Create_DuplicateNumber_Returns400()
    {
        _serviceMock
            .Setup(s => s.CreateBidAsync(It.IsAny<CreateBidCommand>(), default))
            .ReturnsAsync(Result.Failure<BidDto>("Bid number already exists", "DUPLICATE"));

        var command = new CreateBidCommand(
            Name: "Test Bid",
            Number: "BID-001",
            EstimatedValue: 100_000m,
            BidDate: null,
            DueDate: null,
            Owner: null,
            Description: null,
            Items: null);

        var result = await _controller.Create(command);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Create_PassesAllFieldsToService()
    {
        _serviceMock
            .Setup(s => s.CreateBidAsync(It.IsAny<CreateBidCommand>(), default))
            .ReturnsAsync(Result.Success(CreateTestDto()));

        var items = new List<CreateBidItemDto>
        {
            new("Concrete work", BidItemCategory.Material, 500, 125.00m)
        };

        var command = new CreateBidCommand(
            Name: "Highway Bridge",
            Number: "BID-2026-010",
            EstimatedValue: 750_000m,
            BidDate: new DateTime(2026, 3, 1),
            DueDate: new DateTime(2026, 4, 1),
            Owner: "Jane Smith",
            Description: "Major bridge project",
            Items: items);

        await _controller.Create(command);

        _serviceMock.Verify(s => s.CreateBidAsync(
            It.Is<CreateBidCommand>(c =>
                c.Name == "Highway Bridge" &&
                c.Number == "BID-2026-010" &&
                c.EstimatedValue == 750_000m &&
                c.BidDate == new DateTime(2026, 3, 1) &&
                c.DueDate == new DateTime(2026, 4, 1) &&
                c.Owner == "Jane Smith" &&
                c.Description == "Major bridge project" &&
                c.Items != null && c.Items.Count == 1),
            default), Times.Once);
    }

    [Fact]
    public async Task Create_ReturnsCreatedAtRouteWithCorrectId()
    {
        var bidId = Guid.NewGuid();
        var dto = CreateTestDto(bidId);
        _serviceMock
            .Setup(s => s.CreateBidAsync(It.IsAny<CreateBidCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var command = new CreateBidCommand("Test", "BID-001", 100m, null, null, null, null, null);

        var result = await _controller.Create(command);

        var created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        created.RouteValues.Should().ContainKey("id");
        created.RouteValues!["id"].Should().Be(bidId);
    }

    #endregion

    #region GetById

    [Fact]
    public async Task GetById_Found_Returns200()
    {
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.GetBidAsync(TestId, default))
            .ReturnsAsync(Result.Success(dto));

        var result = await _controller.GetById(TestId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(dto);
    }

    [Fact]
    public async Task GetById_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.GetBidAsync(TestId, default))
            .ReturnsAsync(Result.Failure<BidDto>("Bid not found", "NOT_FOUND"));

        var result = await _controller.GetById(TestId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetById_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetBidAsync(TestId, default))
            .ReturnsAsync(Result.Failure<BidDto>("Database error", "DB_ERROR"));

        var result = await _controller.GetById(TestId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region List

    [Fact]
    public async Task List_Success_Returns200()
    {
        var pagedResult = new PagedResult<BidDto>(
            new[] { CreateTestDto() }, TotalCount: 1, Page: 1, PageSize: 10);
        _serviceMock
            .Setup(s => s.GetBidsAsync(It.IsAny<ListBidsQuery>(), default))
            .ReturnsAsync(Result.Success(pagedResult));

        var result = await _controller.List(null, null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(pagedResult);
    }

    [Fact]
    public async Task List_WithFilters_PassesToService()
    {
        var pagedResult = new PagedResult<BidDto>(
            Array.Empty<BidDto>(), 0, 2, 25);
        _serviceMock
            .Setup(s => s.GetBidsAsync(It.IsAny<ListBidsQuery>(), default))
            .ReturnsAsync(Result.Success(pagedResult));

        await _controller.List(BidStatus.Submitted, "highway", 2, 25);

        _serviceMock.Verify(s => s.GetBidsAsync(
            It.Is<ListBidsQuery>(q =>
                q.Status == BidStatus.Submitted &&
                q.Search == "highway" &&
                q.Page == 2 &&
                q.PageSize == 25),
            default), Times.Once);
    }

    [Fact]
    public async Task List_DefaultPagination_PassesDefaults()
    {
        var pagedResult = new PagedResult<BidDto>(
            Array.Empty<BidDto>(), 0, 1, 10);
        _serviceMock
            .Setup(s => s.GetBidsAsync(It.IsAny<ListBidsQuery>(), default))
            .ReturnsAsync(Result.Success(pagedResult));

        await _controller.List(null, null);

        _serviceMock.Verify(s => s.GetBidsAsync(
            It.Is<ListBidsQuery>(q =>
                q.Page == 1 &&
                q.PageSize == 10),
            default), Times.Once);
    }

    [Fact]
    public async Task List_Error_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetBidsAsync(It.IsAny<ListBidsQuery>(), default))
            .ReturnsAsync(Result.Failure<PagedResult<BidDto>>("Invalid query"));

        var result = await _controller.List(null, null);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region Update

    [Fact]
    public async Task Update_Success_Returns200()
    {
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.UpdateBidAsync(It.IsAny<UpdateBidCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var command = new UpdateBidCommand(
            Id: TestId,
            Name: "Updated Bridge Estimate",
            Number: "BID-2026-005",
            Status: BidStatus.Submitted,
            EstimatedValue: 550_000m,
            BidDate: null,
            DueDate: null,
            Owner: "John Doe",
            Description: null,
            Items: null);

        var result = await _controller.Update(TestId, command);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(dto);
    }

    [Fact]
    public async Task Update_IdMismatch_Returns400()
    {
        var routeId = Guid.NewGuid();
        var bodyId = Guid.NewGuid();

        var command = new UpdateBidCommand(
            Id: bodyId,
            Name: "Test",
            Number: "BID-001",
            Status: BidStatus.Draft,
            EstimatedValue: 100m,
            BidDate: null,
            DueDate: null,
            Owner: null,
            Description: null,
            Items: null);

        var result = await _controller.Update(routeId, command);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Update_IdMismatch_DoesNotCallService()
    {
        var routeId = Guid.NewGuid();
        var bodyId = Guid.NewGuid();

        var command = new UpdateBidCommand(
            Id: bodyId,
            Name: "Test",
            Number: "BID-001",
            Status: BidStatus.Draft,
            EstimatedValue: 100m,
            BidDate: null,
            DueDate: null,
            Owner: null,
            Description: null,
            Items: null);

        await _controller.Update(routeId, command);

        _serviceMock.Verify(
            s => s.UpdateBidAsync(It.IsAny<UpdateBidCommand>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Update_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.UpdateBidAsync(It.IsAny<UpdateBidCommand>(), default))
            .ReturnsAsync(Result.Failure<BidDto>("Bid not found", "NOT_FOUND"));

        var command = new UpdateBidCommand(
            Id: TestId,
            Name: "Test",
            Number: "BID-001",
            Status: BidStatus.Draft,
            EstimatedValue: 100m,
            BidDate: null,
            DueDate: null,
            Owner: null,
            Description: null,
            Items: null);

        var result = await _controller.Update(TestId, command);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Update_Conflict_Returns409()
    {
        _serviceMock
            .Setup(s => s.UpdateBidAsync(It.IsAny<UpdateBidCommand>(), default))
            .ReturnsAsync(Result.Failure<BidDto>("Concurrent modification detected", "CONFLICT"));

        var command = new UpdateBidCommand(
            Id: TestId,
            Name: "Test",
            Number: "BID-001",
            Status: BidStatus.Draft,
            EstimatedValue: 100m,
            BidDate: null,
            DueDate: null,
            Owner: null,
            Description: null,
            Items: null);

        var result = await _controller.Update(TestId, command);

        var conflict = result.Should().BeOfType<ConflictObjectResult>().Subject;
        conflict.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task Update_ValidationError_Returns400()
    {
        _serviceMock
            .Setup(s => s.UpdateBidAsync(It.IsAny<UpdateBidCommand>(), default))
            .ReturnsAsync(Result.Failure<BidDto>("Name is required", "VALIDATION_ERROR"));

        var command = new UpdateBidCommand(
            Id: TestId,
            Name: "",
            Number: "BID-001",
            Status: BidStatus.Draft,
            EstimatedValue: 0,
            BidDate: null,
            DueDate: null,
            Owner: null,
            Description: null,
            Items: null);

        var result = await _controller.Update(TestId, command);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Update_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.UpdateBidAsync(It.IsAny<UpdateBidCommand>(), default))
            .ReturnsAsync(Result.Failure<BidDto>("Unknown error", "UNKNOWN"));

        var command = new UpdateBidCommand(
            Id: TestId,
            Name: "Test",
            Number: "BID-001",
            Status: BidStatus.Draft,
            EstimatedValue: 100m,
            BidDate: null,
            DueDate: null,
            Owner: null,
            Description: null,
            Items: null);

        var result = await _controller.Update(TestId, command);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Update_PassesAllFieldsToService()
    {
        _serviceMock
            .Setup(s => s.UpdateBidAsync(It.IsAny<UpdateBidCommand>(), default))
            .ReturnsAsync(Result.Success(CreateTestDto()));

        var items = new List<CreateBidItemDto>
        {
            new("Steel beams", BidItemCategory.Material, 200, 350.00m),
            new("Labor crew", BidItemCategory.Labor, 40, 75.00m)
        };

        var command = new UpdateBidCommand(
            Id: TestId,
            Name: "Updated Bridge",
            Number: "BID-2026-099",
            Status: BidStatus.Won,
            EstimatedValue: 1_200_000m,
            BidDate: new DateTime(2026, 5, 1),
            DueDate: new DateTime(2026, 6, 15),
            Owner: "Jane Smith",
            Description: "Updated description",
            Items: items);

        await _controller.Update(TestId, command);

        _serviceMock.Verify(s => s.UpdateBidAsync(
            It.Is<UpdateBidCommand>(c =>
                c.Id == TestId &&
                c.Name == "Updated Bridge" &&
                c.Number == "BID-2026-099" &&
                c.Status == BidStatus.Won &&
                c.EstimatedValue == 1_200_000m &&
                c.BidDate == new DateTime(2026, 5, 1) &&
                c.DueDate == new DateTime(2026, 6, 15) &&
                c.Owner == "Jane Smith" &&
                c.Description == "Updated description" &&
                c.Items != null && c.Items.Count == 2),
            default), Times.Once);
    }

    #endregion

    #region ConvertToProject

    [Fact]
    public async Task ConvertToProject_Success_Returns200()
    {
        var conversionResult = new ConvertBidToProjectResult(
            ProjectId: Guid.NewGuid(),
            BidId: TestId,
            ProjectName: "Highway Bridge",
            ProjectNumber: "PRJ-2026-010");

        _serviceMock
            .Setup(s => s.ConvertToProjectAsync(It.IsAny<ConvertBidToProjectCommand>(), default))
            .ReturnsAsync(Result.Success(conversionResult));

        var request = new ConvertToProjectRequest("PRJ-2026-010");

        var result = await _controller.ConvertToProject(TestId, request);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(conversionResult);
    }

    [Fact]
    public async Task ConvertToProject_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.ConvertToProjectAsync(It.IsAny<ConvertBidToProjectCommand>(), default))
            .ReturnsAsync(Result.Failure<ConvertBidToProjectResult>("Bid not found", "NOT_FOUND"));

        var request = new ConvertToProjectRequest("PRJ-001");

        var result = await _controller.ConvertToProject(TestId, request);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task ConvertToProject_InvalidStatus_Returns400()
    {
        _serviceMock
            .Setup(s => s.ConvertToProjectAsync(It.IsAny<ConvertBidToProjectCommand>(), default))
            .ReturnsAsync(Result.Failure<ConvertBidToProjectResult>(
                "Bid must have status 'Won' to convert", "INVALID_STATUS"));

        var request = new ConvertToProjectRequest("PRJ-001");

        var result = await _controller.ConvertToProject(TestId, request);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task ConvertToProject_AlreadyConverted_Returns409()
    {
        _serviceMock
            .Setup(s => s.ConvertToProjectAsync(It.IsAny<ConvertBidToProjectCommand>(), default))
            .ReturnsAsync(Result.Failure<ConvertBidToProjectResult>(
                "Bid has already been converted to a project", "ALREADY_CONVERTED"));

        var request = new ConvertToProjectRequest("PRJ-001");

        var result = await _controller.ConvertToProject(TestId, request);

        var conflict = result.Should().BeOfType<ConflictObjectResult>().Subject;
        conflict.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task ConvertToProject_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.ConvertToProjectAsync(It.IsAny<ConvertBidToProjectCommand>(), default))
            .ReturnsAsync(Result.Failure<ConvertBidToProjectResult>("Database error", "DB_ERROR"));

        var request = new ConvertToProjectRequest("PRJ-001");

        var result = await _controller.ConvertToProject(TestId, request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task ConvertToProject_PassesBidIdAndProjectNumber()
    {
        _serviceMock
            .Setup(s => s.ConvertToProjectAsync(It.IsAny<ConvertBidToProjectCommand>(), default))
            .ReturnsAsync(Result.Success(new ConvertBidToProjectResult(
                Guid.NewGuid(), TestId, "Test", "PRJ-2026-050")));

        var request = new ConvertToProjectRequest("PRJ-2026-050");

        await _controller.ConvertToProject(TestId, request);

        _serviceMock.Verify(s => s.ConvertToProjectAsync(
            It.Is<ConvertBidToProjectCommand>(c =>
                c.BidId == TestId &&
                c.ProjectNumber == "PRJ-2026-050"),
            default), Times.Once);
    }

    #endregion

    #region Delete

    [Fact]
    public async Task Delete_Success_Returns204()
    {
        _serviceMock
            .Setup(s => s.DeleteBidAsync(TestId, default))
            .ReturnsAsync(Result.Success());

        var result = await _controller.Delete(TestId);

        result.Should().BeOfType<NoContentResult>();
    }

    [Fact]
    public async Task Delete_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.DeleteBidAsync(TestId, default))
            .ReturnsAsync(Result.Failure("Bid not found", "NOT_FOUND"));

        var result = await _controller.Delete(TestId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Delete_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.DeleteBidAsync(TestId, default))
            .ReturnsAsync(Result.Failure("Cannot delete", "HAS_DEPENDENCIES"));

        var result = await _controller.Delete(TestId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion
}
