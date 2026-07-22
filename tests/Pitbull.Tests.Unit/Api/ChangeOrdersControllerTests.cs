using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreateChangeOrder;
using Pitbull.Contracts.Features.ListChangeOrders;
using Pitbull.Contracts.Features.UpdateChangeOrder;
using Pitbull.Contracts.Services;
using Pitbull.Core.CQRS;

namespace Pitbull.Tests.Unit.Api;

public class ChangeOrdersControllerTests
{
    private readonly Mock<IContractsService> _serviceMock;
    private readonly ChangeOrdersController _controller;

    private static readonly Guid TestId = Guid.NewGuid();
    private static readonly Guid TestSubcontractId = Guid.NewGuid();

    public ChangeOrdersControllerTests()
    {
        _serviceMock = new Mock<IContractsService>();
        _controller = new ChangeOrdersController(_serviceMock.Object);
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
    }

    private static ChangeOrderDto CreateTestDto(Guid? id = null) => new(
        Id: id ?? TestId,
        SubcontractId: TestSubcontractId,
        ChangeOrderNumber: "CO-001",
        Title: "Additional Foundation Work",
        Description: "Extended footings required due to soil conditions",
        Reason: "Field condition",
        Amount: 15_000m,
        DaysExtension: 5,
        Status: ChangeOrderStatus.Pending,
        SubmittedDate: new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc),
        ApprovedDate: null,
        RejectedDate: null,
        ApprovedBy: null,
        RejectedBy: null,
        RejectionReason: null,
        ReferenceNumber: "REF-001",
        CreatedAt: DateTime.UtcNow
    );

    #region Create

    [Fact]
    public async Task Create_Success_Returns201WithChangeOrder()
    {
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.CreateChangeOrderAsync(It.IsAny<CreateChangeOrderCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var command = new CreateChangeOrderCommand(
            SubcontractId: TestSubcontractId,
            ChangeOrderNumber: "CO-001",
            Title: "Additional Foundation Work",
            Description: "Extended footings required due to soil conditions",
            Reason: "Field condition",
            Amount: 15_000m,
            DaysExtension: 5,
            ReferenceNumber: "REF-001");

        var result = await _controller.Create(command);

        var created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        created.StatusCode.Should().Be(201);
        created.Value.Should().Be(dto);
        created.ActionName.Should().Be("GetById");
    }

    [Fact]
    public async Task Create_ReturnsCreatedAtRouteWithCorrectId()
    {
        var changeOrderId = Guid.NewGuid();
        var dto = CreateTestDto(changeOrderId);
        _serviceMock
            .Setup(s => s.CreateChangeOrderAsync(It.IsAny<CreateChangeOrderCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var command = new CreateChangeOrderCommand(
            SubcontractId: TestSubcontractId,
            ChangeOrderNumber: "CO-002",
            Title: "Extra Steel Work",
            Description: "Additional reinforcement needed",
            Reason: "Design change",
            Amount: 25_000m,
            DaysExtension: null,
            ReferenceNumber: null);

        var result = await _controller.Create(command);

        var created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        created.RouteValues.Should().ContainKey("id");
        created.RouteValues!["id"].Should().Be(changeOrderId);
    }

    [Fact]
    public async Task Create_ValidationError_Returns400()
    {
        _serviceMock
            .Setup(s => s.CreateChangeOrderAsync(It.IsAny<CreateChangeOrderCommand>(), default))
            .ReturnsAsync(Result.Failure<ChangeOrderDto>("Title is required", "VALIDATION_ERROR"));

        var command = new CreateChangeOrderCommand(
            SubcontractId: TestSubcontractId,
            ChangeOrderNumber: "CO-001",
            Title: "",
            Description: "Some description",
            Reason: null,
            Amount: 0,
            DaysExtension: null,
            ReferenceNumber: null);

        var result = await _controller.Create(command);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Create_DuplicateNumber_Returns400()
    {
        _serviceMock
            .Setup(s => s.CreateChangeOrderAsync(It.IsAny<CreateChangeOrderCommand>(), default))
            .ReturnsAsync(Result.Failure<ChangeOrderDto>("Change order number already exists", "DUPLICATE_CO_NUMBER"));

        var command = new CreateChangeOrderCommand(
            SubcontractId: TestSubcontractId,
            ChangeOrderNumber: "CO-001",
            Title: "Duplicate CO",
            Description: "This should fail",
            Reason: null,
            Amount: 5_000m,
            DaysExtension: null,
            ReferenceNumber: null);

        var result = await _controller.Create(command);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Create_PassesAllFieldsToService()
    {
        _serviceMock
            .Setup(s => s.CreateChangeOrderAsync(It.IsAny<CreateChangeOrderCommand>(), default))
            .ReturnsAsync(Result.Success(CreateTestDto()));

        var rfiId = Guid.NewGuid();
        var command = new CreateChangeOrderCommand(
            SubcontractId: TestSubcontractId,
            ChangeOrderNumber: "CO-010",
            Title: "Additional Foundation Work",
            Description: "Extended footings required",
            Reason: "Field condition",
            Amount: 15_000m,
            DaysExtension: 5,
            ReferenceNumber: "REF-010",
            OriginatingRfiId: rfiId);

        await _controller.Create(command);

        _serviceMock.Verify(s => s.CreateChangeOrderAsync(
            It.Is<CreateChangeOrderCommand>(c =>
                c.SubcontractId == TestSubcontractId &&
                c.ChangeOrderNumber == "CO-010" &&
                c.Title == "Additional Foundation Work" &&
                c.Description == "Extended footings required" &&
                c.Reason == "Field condition" &&
                c.Amount == 15_000m &&
                c.DaysExtension == 5 &&
                c.ReferenceNumber == "REF-010" &&
                c.OriginatingRfiId == rfiId),
            default), Times.Once);
    }

    [Fact]
    public async Task Create_ErrorResponse_ContainsErrorAndCode()
    {
        _serviceMock
            .Setup(s => s.CreateChangeOrderAsync(It.IsAny<CreateChangeOrderCommand>(), default))
            .ReturnsAsync(Result.Failure<ChangeOrderDto>("Amount cannot be zero", "VALIDATION_ERROR"));

        var command = new CreateChangeOrderCommand(
            SubcontractId: TestSubcontractId,
            ChangeOrderNumber: "CO-001",
            Title: "Test",
            Description: "Test description",
            Reason: null,
            Amount: 0m,
            DaysExtension: null,
            ReferenceNumber: null);

        var result = await _controller.Create(command);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
        bad.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task Create_NegativeAmount_PassesThrough()
    {
        var dto = CreateTestDto() with { Amount = -10_000m };
        _serviceMock
            .Setup(s => s.CreateChangeOrderAsync(It.IsAny<CreateChangeOrderCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var command = new CreateChangeOrderCommand(
            SubcontractId: TestSubcontractId,
            ChangeOrderNumber: "CO-003",
            Title: "Deductive Change Order",
            Description: "Reduced scope of work",
            Reason: "Owner request",
            Amount: -10_000m,
            DaysExtension: null,
            ReferenceNumber: null);

        var result = await _controller.Create(command);

        var created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        var returnedDto = created.Value.Should().BeOfType<ChangeOrderDto>().Subject;
        returnedDto.Amount.Should().Be(-10_000m);
    }

    #endregion

    #region GetById

    [Fact]
    public async Task GetById_Found_Returns200()
    {
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.GetChangeOrderAsync(TestId, default))
            .ReturnsAsync(Result.Success(dto));

        var result = await _controller.GetById(TestId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(dto);
    }

    [Fact]
    public async Task GetById_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.GetChangeOrderAsync(TestId, default))
            .ReturnsAsync(Result.Failure<ChangeOrderDto>("Change order not found", "NOT_FOUND"));

        var result = await _controller.GetById(TestId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetById_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetChangeOrderAsync(TestId, default))
            .ReturnsAsync(Result.Failure<ChangeOrderDto>("Database error", "DB_ERROR"));

        var result = await _controller.GetById(TestId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task GetById_ReturnsFullDtoFields()
    {
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.GetChangeOrderAsync(TestId, default))
            .ReturnsAsync(Result.Success(dto));

        var result = await _controller.GetById(TestId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var returned = ok.Value.Should().BeOfType<ChangeOrderDto>().Subject;
        returned.Id.Should().Be(dto.Id);
        returned.SubcontractId.Should().Be(TestSubcontractId);
        returned.ChangeOrderNumber.Should().Be("CO-001");
        returned.Title.Should().Be("Additional Foundation Work");
        returned.Description.Should().Be("Extended footings required due to soil conditions");
        returned.Reason.Should().Be("Field condition");
        returned.Amount.Should().Be(15_000m);
        returned.DaysExtension.Should().Be(5);
        returned.Status.Should().Be(ChangeOrderStatus.Pending);
        returned.ReferenceNumber.Should().Be("REF-001");
    }

    [Fact]
    public async Task GetById_UnauthorizedError_Returns401()
    {
        _serviceMock
            .Setup(s => s.GetChangeOrderAsync(TestId, default))
            .ReturnsAsync(Result.Failure<ChangeOrderDto>("Unauthorized access", "UNAUTHORIZED"));

        var result = await _controller.GetById(TestId);

        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task GetById_ForbiddenError_Returns403()
    {
        _serviceMock
            .Setup(s => s.GetChangeOrderAsync(TestId, default))
            .ReturnsAsync(Result.Failure<ChangeOrderDto>("Access forbidden", "FORBIDDEN"));

        var result = await _controller.GetById(TestId);

        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(403);
    }

    #endregion

    #region List

    [Fact]
    public async Task List_Success_Returns200()
    {
        var pagedResult = new PagedResult<ChangeOrderDto>(
            new[] { CreateTestDto() }, TotalCount: 1, Page: 1, PageSize: 20);
        _serviceMock
            .Setup(s => s.ListChangeOrdersAsync(It.IsAny<ListChangeOrdersQuery>(), default))
            .ReturnsAsync(Result.Success(pagedResult));

        var result = await _controller.List(null, null, null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(pagedResult);
    }

    [Fact]
    public async Task List_ViewMobile_ReturnsSlimMobileDto()
    {
        var pagedResult = new PagedResult<ChangeOrderDto>(
            new[] { CreateTestDto() }, TotalCount: 1, Page: 1, PageSize: 20);
        _serviceMock
            .Setup(s => s.ListChangeOrdersAsync(It.IsAny<ListChangeOrdersQuery>(), default))
            .ReturnsAsync(Result.Success(pagedResult));

        var projectId = Guid.NewGuid();
        var result = await _controller.List(null, null, null, 1, 20, projectId, view: "mobile");

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var paged = ok.Value.Should().BeOfType<PagedResult<Pitbull.Contracts.Features.ChangeOrderMobileListItemDto>>().Subject;
        paged.Items.Should().HaveCount(1);
        paged.Items[0].Number.Should().Be("CO-001");
        paged.Items[0].ProjectId.Should().Be(projectId);
        paged.Items[0].GetType().GetProperty("Description").Should().BeNull();
    }

    [Fact]
    public async Task List_WithFilters_PassesToService()
    {
        var pagedResult = new PagedResult<ChangeOrderDto>(
            Array.Empty<ChangeOrderDto>(), 0, 2, 25);
        _serviceMock
            .Setup(s => s.ListChangeOrdersAsync(It.IsAny<ListChangeOrdersQuery>(), default))
            .ReturnsAsync(Result.Success(pagedResult));

        await _controller.List(TestSubcontractId, ChangeOrderStatus.Approved, "foundation", 2, 25);

        _serviceMock.Verify(s => s.ListChangeOrdersAsync(
            It.Is<ListChangeOrdersQuery>(q =>
                q.SubcontractId == TestSubcontractId &&
                q.Status == ChangeOrderStatus.Approved &&
                q.Search == "foundation" &&
                q.Page == 2 &&
                q.PageSize == 25),
            default), Times.Once);
    }

    [Fact]
    public async Task List_DefaultPagination_PassesDefaults()
    {
        var pagedResult = new PagedResult<ChangeOrderDto>(
            Array.Empty<ChangeOrderDto>(), 0, 1, 20);
        _serviceMock
            .Setup(s => s.ListChangeOrdersAsync(It.IsAny<ListChangeOrdersQuery>(), default))
            .ReturnsAsync(Result.Success(pagedResult));

        await _controller.List(null, null, null);

        _serviceMock.Verify(s => s.ListChangeOrdersAsync(
            It.Is<ListChangeOrdersQuery>(q =>
                q.Page == 1 &&
                q.PageSize == 20),
            default), Times.Once);
    }

    [Fact]
    public async Task List_Error_Returns400()
    {
        _serviceMock
            .Setup(s => s.ListChangeOrdersAsync(It.IsAny<ListChangeOrdersQuery>(), default))
            .ReturnsAsync(Result.Failure<PagedResult<ChangeOrderDto>>("Invalid query"));

        var result = await _controller.List(null, null, null);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task List_EmptyResults_Returns200WithEmptyList()
    {
        var pagedResult = new PagedResult<ChangeOrderDto>(
            Array.Empty<ChangeOrderDto>(), 0, 1, 20);
        _serviceMock
            .Setup(s => s.ListChangeOrdersAsync(It.IsAny<ListChangeOrdersQuery>(), default))
            .ReturnsAsync(Result.Success(pagedResult));

        var result = await _controller.List(null, null, null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var paged = ok.Value.Should().BeOfType<PagedResult<ChangeOrderDto>>().Subject;
        paged.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task List_NullFilters_PassesNullToQuery()
    {
        var pagedResult = new PagedResult<ChangeOrderDto>(
            Array.Empty<ChangeOrderDto>(), 0, 1, 20);
        _serviceMock
            .Setup(s => s.ListChangeOrdersAsync(It.IsAny<ListChangeOrdersQuery>(), default))
            .ReturnsAsync(Result.Success(pagedResult));

        await _controller.List(null, null, null);

        _serviceMock.Verify(s => s.ListChangeOrdersAsync(
            It.Is<ListChangeOrdersQuery>(q =>
                q.SubcontractId == null &&
                q.Status == null &&
                q.Search == null),
            default), Times.Once);
    }

    [Fact]
    public async Task List_FilterByStatus_PassesStatusToQuery()
    {
        var pagedResult = new PagedResult<ChangeOrderDto>(
            Array.Empty<ChangeOrderDto>(), 0, 1, 20);
        _serviceMock
            .Setup(s => s.ListChangeOrdersAsync(It.IsAny<ListChangeOrdersQuery>(), default))
            .ReturnsAsync(Result.Success(pagedResult));

        await _controller.List(null, ChangeOrderStatus.Rejected, null);

        _serviceMock.Verify(s => s.ListChangeOrdersAsync(
            It.Is<ListChangeOrdersQuery>(q =>
                q.Status == ChangeOrderStatus.Rejected),
            default), Times.Once);
    }

    #endregion

    #region Update

    [Fact]
    public async Task Update_Success_Returns200()
    {
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.UpdateChangeOrderAsync(It.IsAny<UpdateChangeOrderCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var command = new UpdateChangeOrderCommand(
            Id: TestId,
            ChangeOrderNumber: "CO-001",
            Title: "Updated Foundation Work",
            Description: "Updated description",
            Reason: "Field condition",
            Amount: 18_000m,
            DaysExtension: 7,
            Status: ChangeOrderStatus.Pending,
            ReferenceNumber: "REF-001");

        var result = await _controller.Update(TestId, command);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(dto);
    }

    [Fact]
    public async Task Update_IdMismatch_Returns400()
    {
        var routeId = Guid.NewGuid();
        var bodyId = Guid.NewGuid();

        var command = new UpdateChangeOrderCommand(
            Id: bodyId,
            ChangeOrderNumber: "CO-001",
            Title: "Test",
            Description: "Test",
            Reason: null,
            Amount: 5_000m,
            DaysExtension: null,
            Status: ChangeOrderStatus.Pending,
            ReferenceNumber: null);

        var result = await _controller.Update(routeId, command);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Update_IdMismatch_DoesNotCallService()
    {
        var routeId = Guid.NewGuid();
        var bodyId = Guid.NewGuid();

        var command = new UpdateChangeOrderCommand(
            Id: bodyId,
            ChangeOrderNumber: "CO-001",
            Title: "Test",
            Description: "Test",
            Reason: null,
            Amount: 5_000m,
            DaysExtension: null,
            Status: ChangeOrderStatus.Pending,
            ReferenceNumber: null);

        await _controller.Update(routeId, command);

        _serviceMock.Verify(
            s => s.UpdateChangeOrderAsync(It.IsAny<UpdateChangeOrderCommand>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Update_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.UpdateChangeOrderAsync(It.IsAny<UpdateChangeOrderCommand>(), default))
            .ReturnsAsync(Result.Failure<ChangeOrderDto>("Change order not found", "NOT_FOUND"));

        var command = new UpdateChangeOrderCommand(
            Id: TestId,
            ChangeOrderNumber: "CO-001",
            Title: "Test",
            Description: "Test",
            Reason: null,
            Amount: 5_000m,
            DaysExtension: null,
            Status: ChangeOrderStatus.Pending,
            ReferenceNumber: null);

        var result = await _controller.Update(TestId, command);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Update_DuplicateCoNumber_Returns400()
    {
        _serviceMock
            .Setup(s => s.UpdateChangeOrderAsync(It.IsAny<UpdateChangeOrderCommand>(), default))
            .ReturnsAsync(Result.Failure<ChangeOrderDto>("Duplicate change order number", "DUPLICATE_CO_NUMBER"));

        var command = new UpdateChangeOrderCommand(
            Id: TestId,
            ChangeOrderNumber: "CO-001",
            Title: "Test",
            Description: "Test",
            Reason: null,
            Amount: 5_000m,
            DaysExtension: null,
            Status: ChangeOrderStatus.Pending,
            ReferenceNumber: null);

        var result = await _controller.Update(TestId, command);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Update_ValidationError_Returns400()
    {
        _serviceMock
            .Setup(s => s.UpdateChangeOrderAsync(It.IsAny<UpdateChangeOrderCommand>(), default))
            .ReturnsAsync(Result.Failure<ChangeOrderDto>("Title is required", "VALIDATION_ERROR"));

        var command = new UpdateChangeOrderCommand(
            Id: TestId,
            ChangeOrderNumber: "CO-001",
            Title: "",
            Description: "Test",
            Reason: null,
            Amount: 5_000m,
            DaysExtension: null,
            Status: ChangeOrderStatus.Pending,
            ReferenceNumber: null);

        var result = await _controller.Update(TestId, command);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Update_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.UpdateChangeOrderAsync(It.IsAny<UpdateChangeOrderCommand>(), default))
            .ReturnsAsync(Result.Failure<ChangeOrderDto>("Unknown error", "UNKNOWN"));

        var command = new UpdateChangeOrderCommand(
            Id: TestId,
            ChangeOrderNumber: "CO-001",
            Title: "Test",
            Description: "Test",
            Reason: null,
            Amount: 5_000m,
            DaysExtension: null,
            Status: ChangeOrderStatus.Pending,
            ReferenceNumber: null);

        var result = await _controller.Update(TestId, command);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Update_PassesAllFieldsToService()
    {
        _serviceMock
            .Setup(s => s.UpdateChangeOrderAsync(It.IsAny<UpdateChangeOrderCommand>(), default))
            .ReturnsAsync(Result.Success(CreateTestDto()));

        var command = new UpdateChangeOrderCommand(
            Id: TestId,
            ChangeOrderNumber: "CO-099",
            Title: "Updated Title",
            Description: "Updated description for change order",
            Reason: "Design change",
            Amount: 45_000m,
            DaysExtension: 14,
            Status: ChangeOrderStatus.Approved,
            ReferenceNumber: "REF-099");

        await _controller.Update(TestId, command);

        _serviceMock.Verify(s => s.UpdateChangeOrderAsync(
            It.Is<UpdateChangeOrderCommand>(c =>
                c.Id == TestId &&
                c.ChangeOrderNumber == "CO-099" &&
                c.Title == "Updated Title" &&
                c.Description == "Updated description for change order" &&
                c.Reason == "Design change" &&
                c.Amount == 45_000m &&
                c.DaysExtension == 14 &&
                c.Status == ChangeOrderStatus.Approved &&
                c.ReferenceNumber == "REF-099"),
            default), Times.Once);
    }

    [Fact]
    public async Task Update_StatusTransition_PendingToApproved_Returns200()
    {
        var dto = CreateTestDto() with
        {
            Status = ChangeOrderStatus.Approved,
            ApprovedDate = new DateTime(2026, 2, 10, 0, 0, 0, DateTimeKind.Utc),
            ApprovedBy = "admin"
        };
        _serviceMock
            .Setup(s => s.UpdateChangeOrderAsync(It.IsAny<UpdateChangeOrderCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var command = new UpdateChangeOrderCommand(
            Id: TestId,
            ChangeOrderNumber: "CO-001",
            Title: "Additional Foundation Work",
            Description: "Extended footings required",
            Reason: "Field condition",
            Amount: 15_000m,
            DaysExtension: 5,
            Status: ChangeOrderStatus.Approved,
            ReferenceNumber: "REF-001");

        var result = await _controller.Update(TestId, command);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var returnedDto = ok.Value.Should().BeOfType<ChangeOrderDto>().Subject;
        returnedDto.Status.Should().Be(ChangeOrderStatus.Approved);
    }

    [Fact]
    public async Task Update_StatusTransition_PendingToRejected_Returns200()
    {
        var dto = CreateTestDto() with
        {
            Status = ChangeOrderStatus.Rejected,
            RejectedDate = new DateTime(2026, 2, 10, 0, 0, 0, DateTimeKind.Utc),
            RejectedBy = "admin",
            RejectionReason = "Budget constraints"
        };
        _serviceMock
            .Setup(s => s.UpdateChangeOrderAsync(It.IsAny<UpdateChangeOrderCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var command = new UpdateChangeOrderCommand(
            Id: TestId,
            ChangeOrderNumber: "CO-001",
            Title: "Additional Foundation Work",
            Description: "Extended footings required",
            Reason: "Field condition",
            Amount: 15_000m,
            DaysExtension: 5,
            Status: ChangeOrderStatus.Rejected,
            ReferenceNumber: null);

        var result = await _controller.Update(TestId, command);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var returnedDto = ok.Value.Should().BeOfType<ChangeOrderDto>().Subject;
        returnedDto.Status.Should().Be(ChangeOrderStatus.Rejected);
    }

    #endregion

    #region Delete

    [Fact]
    public async Task Delete_Success_Returns204()
    {
        _serviceMock
            .Setup(s => s.DeleteChangeOrderAsync(TestId, default))
            .ReturnsAsync(Result.Success());

        var result = await _controller.Delete(TestId);

        result.Should().BeOfType<NoContentResult>();
    }

    [Fact]
    public async Task Delete_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.DeleteChangeOrderAsync(TestId, default))
            .ReturnsAsync(Result.Failure("Change order not found", "NOT_FOUND"));

        var result = await _controller.Delete(TestId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Delete_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.DeleteChangeOrderAsync(TestId, default))
            .ReturnsAsync(Result.Failure("Delete failed", "INTERNAL_ERROR"));

        var result = await _controller.Delete(TestId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Delete_PassesIdToService()
    {
        var deleteId = Guid.NewGuid();
        _serviceMock
            .Setup(s => s.DeleteChangeOrderAsync(deleteId, default))
            .ReturnsAsync(Result.Success());

        await _controller.Delete(deleteId);

        _serviceMock.Verify(s => s.DeleteChangeOrderAsync(deleteId, default), Times.Once);
    }

    #endregion
}
