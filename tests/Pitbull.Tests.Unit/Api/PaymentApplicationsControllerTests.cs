using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreatePaymentApplication;
using Pitbull.Contracts.Features.ListPaymentApplications;
using Pitbull.Contracts.Features.UpdatePaymentApplication;
using Pitbull.Contracts.Services;
using Pitbull.Core.CQRS;

namespace Pitbull.Tests.Unit.Api;

public class PaymentApplicationsControllerTests
{
    private readonly Mock<IContractsService> _serviceMock;
    private readonly Mock<IPaymentApplicationService> _payAppServiceMock;
    private readonly PaymentApplicationsController _controller;

    private static readonly Guid TestId = Guid.NewGuid();
    private static readonly Guid TestSubcontractId = Guid.NewGuid();

    public PaymentApplicationsControllerTests()
    {
        _serviceMock = new Mock<IContractsService>();
        _payAppServiceMock = new Mock<IPaymentApplicationService>();
        _controller = new PaymentApplicationsController(_serviceMock.Object, _payAppServiceMock.Object);
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
    }

    private static PaymentApplicationDto CreateTestDto(Guid? id = null) => new(
        Id: id ?? TestId,
        SubcontractId: TestSubcontractId,
        ApplicationNumber: 1,
        PeriodStart: new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc),
        PeriodEnd: new DateTime(2026, 2, 28, 0, 0, 0, DateTimeKind.Utc),
        ScheduledValue: 150_000m,
        WorkCompletedPrevious: 50_000m,
        WorkCompletedThisPeriod: 25_000m,
        WorkCompletedToDate: 75_000m,
        StoredMaterials: 5_000m,
        TotalCompletedAndStored: 80_000m,
        RetainagePercent: 10m,
        RetainageThisPeriod: 3_000m,
        RetainagePrevious: 5_000m,
        TotalRetainage: 8_000m,
        TotalEarnedLessRetainage: 72_000m,
        LessPreviousCertificates: 45_000m,
        CurrentPaymentDue: 27_000m,
        Status: PaymentApplicationStatus.Draft,
        SubmittedDate: null,
        ReviewedDate: null,
        ApprovedDate: null,
        PaidDate: null,
        ApprovedBy: null,
        ApprovedAmount: null,
        Notes: "Test payment application",
        InvoiceNumber: "INV-2026-001",
        CheckNumber: null,
        CreatedAt: DateTime.UtcNow
    );

    #region Create

    [Fact]
    public async Task Create_Success_Returns201WithPaymentApplication()
    {
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.CreatePaymentApplicationAsync(It.IsAny<CreatePaymentApplicationCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var command = new CreatePaymentApplicationCommand(
            SubcontractId: TestSubcontractId,
            PeriodStart: new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd: new DateTime(2026, 2, 28, 0, 0, 0, DateTimeKind.Utc),
            WorkCompletedThisPeriod: 25_000m,
            StoredMaterials: 5_000m,
            InvoiceNumber: "INV-2026-001",
            Notes: "Test payment application"
        );

        var result = await _controller.Create(command);

        var createdResult = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        createdResult.StatusCode.Should().Be(201);
        createdResult.Value.Should().BeEquivalentTo(dto);
    }

    [Fact]
    public async Task Create_ValidationError_Returns400()
    {
        _serviceMock
            .Setup(s => s.CreatePaymentApplicationAsync(It.IsAny<CreatePaymentApplicationCommand>(), default))
            .ReturnsAsync(Result.Failure<PaymentApplicationDto>("Period end must be after period start", "VALIDATION_FAILED"));

        var command = new CreatePaymentApplicationCommand(
            SubcontractId: TestSubcontractId,
            PeriodStart: new DateTime(2026, 2, 28, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd: new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc),
            WorkCompletedThisPeriod: 25_000m,
            StoredMaterials: 0m,
            InvoiceNumber: null,
            Notes: null
        );

        var result = await _controller.Create(command);

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequest.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Create_PassesCommandToService()
    {
        var dto = CreateTestDto();
        CreatePaymentApplicationCommand? capturedCommand = null;
        _serviceMock
            .Setup(s => s.CreatePaymentApplicationAsync(It.IsAny<CreatePaymentApplicationCommand>(), default))
            .Callback<CreatePaymentApplicationCommand, CancellationToken>((cmd, _) => capturedCommand = cmd)
            .ReturnsAsync(Result.Success(dto));

        var command = new CreatePaymentApplicationCommand(
            SubcontractId: TestSubcontractId,
            PeriodStart: new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd: new DateTime(2026, 2, 28, 0, 0, 0, DateTimeKind.Utc),
            WorkCompletedThisPeriod: 25_000m,
            StoredMaterials: 5_000m,
            InvoiceNumber: "INV-2026-001",
            Notes: "Test notes"
        );

        await _controller.Create(command);

        capturedCommand.Should().NotBeNull();
        capturedCommand!.SubcontractId.Should().Be(TestSubcontractId);
        capturedCommand.WorkCompletedThisPeriod.Should().Be(25_000m);
        capturedCommand.StoredMaterials.Should().Be(5_000m);
        capturedCommand.InvoiceNumber.Should().Be("INV-2026-001");
        capturedCommand.Notes.Should().Be("Test notes");
    }

    [Fact]
    public async Task Create_ReturnsCreatedAtActionWithCorrectRouteId()
    {
        var testId = Guid.NewGuid();
        var dto = CreateTestDto(testId);
        _serviceMock
            .Setup(s => s.CreatePaymentApplicationAsync(It.IsAny<CreatePaymentApplicationCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var command = new CreatePaymentApplicationCommand(
            SubcontractId: TestSubcontractId,
            PeriodStart: new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd: new DateTime(2026, 2, 28, 0, 0, 0, DateTimeKind.Utc),
            WorkCompletedThisPeriod: 25_000m,
            StoredMaterials: 0m,
            InvoiceNumber: null,
            Notes: null
        );

        var result = await _controller.Create(command);

        var createdResult = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        createdResult.ActionName.Should().Be("GetById");
        createdResult.RouteValues!["id"].Should().Be(testId);
    }

    #endregion

    #region GetById

    [Fact]
    public async Task GetById_Found_Returns200()
    {
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.GetPaymentApplicationAsync(TestId, default))
            .ReturnsAsync(Result.Success(dto));

        var result = await _controller.GetById(TestId);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(200);
        okResult.Value.Should().BeEquivalentTo(dto);
    }

    [Fact]
    public async Task GetById_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.GetPaymentApplicationAsync(TestId, default))
            .ReturnsAsync(Result.Failure<PaymentApplicationDto>("Payment application not found", "NOT_FOUND"));

        var result = await _controller.GetById(TestId);

        var notFoundResult = result.Should().BeOfType<NotFoundObjectResult>().Subject;
        notFoundResult.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task GetById_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetPaymentApplicationAsync(TestId, default))
            .ReturnsAsync(Result.Failure<PaymentApplicationDto>("Something went wrong"));

        var result = await _controller.GetById(TestId);

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequest.StatusCode.Should().Be(400);
    }

    #endregion

    #region List

    [Fact]
    public async Task List_Success_Returns200()
    {
        var items = new[] { CreateTestDto() };
        var pagedResult = new PagedResult<PaymentApplicationDto>(items, 1, 1, 20);
        _serviceMock
            .Setup(s => s.ListPaymentApplicationsAsync(It.IsAny<ListPaymentApplicationsQuery>(), default))
            .ReturnsAsync(Result.Success(pagedResult));

        var result = await _controller.List(null, null, 1, 20);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task List_PassesFiltersToService()
    {
        ListPaymentApplicationsQuery? capturedQuery = null;
        var pagedResult = new PagedResult<PaymentApplicationDto>(Array.Empty<PaymentApplicationDto>(), 0, 1, 10);
        _serviceMock
            .Setup(s => s.ListPaymentApplicationsAsync(It.IsAny<ListPaymentApplicationsQuery>(), default))
            .Callback<ListPaymentApplicationsQuery, CancellationToken>((q, _) => capturedQuery = q)
            .ReturnsAsync(Result.Success(pagedResult));

        await _controller.List(TestSubcontractId, PaymentApplicationStatus.Submitted, 2, 10);

        capturedQuery.Should().NotBeNull();
        capturedQuery!.SubcontractId.Should().Be(TestSubcontractId);
        capturedQuery.Status.Should().Be(PaymentApplicationStatus.Submitted);
        capturedQuery.Page.Should().Be(2);
        capturedQuery.PageSize.Should().Be(10);
    }

    [Fact]
    public async Task List_Error_Returns400()
    {
        _serviceMock
            .Setup(s => s.ListPaymentApplicationsAsync(It.IsAny<ListPaymentApplicationsQuery>(), default))
            .ReturnsAsync(Result.Failure<PagedResult<PaymentApplicationDto>>("Query failed"));

        var result = await _controller.List(null, null, 1, 20);

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequest.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task List_EmptyResults_Returns200()
    {
        var pagedResult = new PagedResult<PaymentApplicationDto>(Array.Empty<PaymentApplicationDto>(), 0, 1, 20);
        _serviceMock
            .Setup(s => s.ListPaymentApplicationsAsync(It.IsAny<ListPaymentApplicationsQuery>(), default))
            .ReturnsAsync(Result.Success(pagedResult));

        var result = await _controller.List(null, null, 1, 20);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task List_NullFilters_PassesNulls()
    {
        ListPaymentApplicationsQuery? capturedQuery = null;
        var pagedResult = new PagedResult<PaymentApplicationDto>(Array.Empty<PaymentApplicationDto>(), 0, 1, 20);
        _serviceMock
            .Setup(s => s.ListPaymentApplicationsAsync(It.IsAny<ListPaymentApplicationsQuery>(), default))
            .Callback<ListPaymentApplicationsQuery, CancellationToken>((q, _) => capturedQuery = q)
            .ReturnsAsync(Result.Success(pagedResult));

        await _controller.List(null, null, 1, 20);

        capturedQuery.Should().NotBeNull();
        capturedQuery!.SubcontractId.Should().BeNull();
        capturedQuery.Status.Should().BeNull();
    }

    #endregion

    #region Update

    [Fact]
    public async Task Update_Success_Returns200()
    {
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.UpdatePaymentApplicationAsync(It.IsAny<UpdatePaymentApplicationCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var command = new UpdatePaymentApplicationCommand(
            Id: TestId,
            WorkCompletedThisPeriod: 30_000m,
            StoredMaterials: 6_000m,
            Status: PaymentApplicationStatus.Submitted,
            ApprovedBy: null,
            ApprovedAmount: null,
            InvoiceNumber: "INV-2026-001",
            CheckNumber: null,
            Notes: "Updated notes"
        );

        var result = await _controller.Update(TestId, command);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(200);
        okResult.Value.Should().BeEquivalentTo(dto);
    }

    [Fact]
    public async Task Update_RouteIdMismatch_Returns400()
    {
        var routeId = Guid.NewGuid();
        var bodyId = Guid.NewGuid();

        var command = new UpdatePaymentApplicationCommand(
            Id: bodyId,
            WorkCompletedThisPeriod: 30_000m,
            StoredMaterials: 0m,
            Status: PaymentApplicationStatus.Draft,
            ApprovedBy: null,
            ApprovedAmount: null,
            InvoiceNumber: null,
            CheckNumber: null,
            Notes: null
        );

        var result = await _controller.Update(routeId, command);

        result.Should().BeOfType<BadRequestObjectResult>();
        _serviceMock.Verify(
            s => s.UpdatePaymentApplicationAsync(It.IsAny<UpdatePaymentApplicationCommand>(), default),
            Times.Never
        );
    }

    [Fact]
    public async Task Update_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.UpdatePaymentApplicationAsync(It.IsAny<UpdatePaymentApplicationCommand>(), default))
            .ReturnsAsync(Result.Failure<PaymentApplicationDto>("Payment application not found", "NOT_FOUND"));

        var command = new UpdatePaymentApplicationCommand(
            Id: TestId,
            WorkCompletedThisPeriod: 30_000m,
            StoredMaterials: 0m,
            Status: PaymentApplicationStatus.Draft,
            ApprovedBy: null,
            ApprovedAmount: null,
            InvoiceNumber: null,
            CheckNumber: null,
            Notes: null
        );

        var result = await _controller.Update(TestId, command);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Update_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.UpdatePaymentApplicationAsync(It.IsAny<UpdatePaymentApplicationCommand>(), default))
            .ReturnsAsync(Result.Failure<PaymentApplicationDto>("Invalid data"));

        var command = new UpdatePaymentApplicationCommand(
            Id: TestId,
            WorkCompletedThisPeriod: -1m,
            StoredMaterials: 0m,
            Status: PaymentApplicationStatus.Draft,
            ApprovedBy: null,
            ApprovedAmount: null,
            InvoiceNumber: null,
            CheckNumber: null,
            Notes: null
        );

        var result = await _controller.Update(TestId, command);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Update_PassesFieldsToService()
    {
        UpdatePaymentApplicationCommand? capturedCommand = null;
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.UpdatePaymentApplicationAsync(It.IsAny<UpdatePaymentApplicationCommand>(), default))
            .Callback<UpdatePaymentApplicationCommand, CancellationToken>((cmd, _) => capturedCommand = cmd)
            .ReturnsAsync(Result.Success(dto));

        var command = new UpdatePaymentApplicationCommand(
            Id: TestId,
            WorkCompletedThisPeriod: 35_000m,
            StoredMaterials: 7_500m,
            Status: PaymentApplicationStatus.Approved,
            ApprovedBy: "John PM",
            ApprovedAmount: 35_000m,
            InvoiceNumber: "INV-2026-002",
            CheckNumber: "CHK-5001",
            Notes: "Approved with full amount"
        );

        await _controller.Update(TestId, command);

        capturedCommand.Should().NotBeNull();
        capturedCommand!.Id.Should().Be(TestId);
        capturedCommand.WorkCompletedThisPeriod.Should().Be(35_000m);
        capturedCommand.StoredMaterials.Should().Be(7_500m);
        capturedCommand.Status.Should().Be(PaymentApplicationStatus.Approved);
        capturedCommand.ApprovedBy.Should().Be("John PM");
        capturedCommand.ApprovedAmount.Should().Be(35_000m);
        capturedCommand.InvoiceNumber.Should().Be("INV-2026-002");
        capturedCommand.CheckNumber.Should().Be("CHK-5001");
        capturedCommand.Notes.Should().Be("Approved with full amount");
    }

    [Fact]
    public async Task Update_StatusTransition_Returns200()
    {
        var submittedDto = CreateTestDto() with
        {
            Status = PaymentApplicationStatus.Submitted,
            SubmittedDate = DateTime.UtcNow
        };
        _serviceMock
            .Setup(s => s.UpdatePaymentApplicationAsync(It.IsAny<UpdatePaymentApplicationCommand>(), default))
            .ReturnsAsync(Result.Success(submittedDto));

        var command = new UpdatePaymentApplicationCommand(
            Id: TestId,
            WorkCompletedThisPeriod: 25_000m,
            StoredMaterials: 5_000m,
            Status: PaymentApplicationStatus.Submitted,
            ApprovedBy: null,
            ApprovedAmount: null,
            InvoiceNumber: "INV-2026-001",
            CheckNumber: null,
            Notes: null
        );

        var result = await _controller.Update(TestId, command);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var returnedDto = okResult.Value.Should().BeOfType<PaymentApplicationDto>().Subject;
        returnedDto.Status.Should().Be(PaymentApplicationStatus.Submitted);
        returnedDto.SubmittedDate.Should().NotBeNull();
    }

    #endregion

    #region Delete

    [Fact]
    public async Task Delete_Success_Returns204()
    {
        _serviceMock
            .Setup(s => s.DeletePaymentApplicationAsync(TestId, default))
            .ReturnsAsync(Result.Success());

        var result = await _controller.Delete(TestId);

        result.Should().BeOfType<NoContentResult>();
    }

    [Fact]
    public async Task Delete_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.DeletePaymentApplicationAsync(TestId, default))
            .ReturnsAsync(Result.Failure("Payment application not found", "NOT_FOUND"));

        var result = await _controller.Delete(TestId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Delete_InvalidStatus_Returns400()
    {
        _serviceMock
            .Setup(s => s.DeletePaymentApplicationAsync(TestId, default))
            .ReturnsAsync(Result.Failure("Cannot delete non-draft application", "INVALID_STATUS"));

        var result = await _controller.Delete(TestId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Delete_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.DeletePaymentApplicationAsync(TestId, default))
            .ReturnsAsync(Result.Failure("Something went wrong"));

        var result = await _controller.Delete(TestId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Delete_PassesIdToService()
    {
        var targetId = Guid.NewGuid();
        _serviceMock
            .Setup(s => s.DeletePaymentApplicationAsync(targetId, default))
            .ReturnsAsync(Result.Success());

        await _controller.Delete(targetId);

        _serviceMock.Verify(s => s.DeletePaymentApplicationAsync(targetId, default), Times.Once);
    }

    #endregion
}
