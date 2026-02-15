using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreateSubcontract;
using Pitbull.Contracts.Features.ListSubcontracts;
using Pitbull.Contracts.Features.UpdateSubcontract;
using Pitbull.Contracts.Services;
using Pitbull.Core.CQRS;

namespace Pitbull.Tests.Unit.Api;

public class SubcontractsControllerTests
{
    private readonly Mock<IContractsService> _serviceMock;
    private readonly SubcontractsController _controller;

    private static readonly Guid TestId = Guid.NewGuid();
    private static readonly Guid TestProjectId = Guid.NewGuid();

    public SubcontractsControllerTests()
    {
        _serviceMock = new Mock<IContractsService>();
        _controller = new SubcontractsController(_serviceMock.Object);
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
    }

    private static SubcontractDto CreateTestDto(Guid? id = null) => new(
        Id: id ?? TestId,
        ProjectId: TestProjectId,
        SubcontractNumber: "SC-2026-001",
        SubcontractorName: "ABC Concrete Inc",
        SubcontractorContact: "John Smith",
        SubcontractorEmail: "john@abcconcrete.com",
        SubcontractorPhone: "555-123-4567",
        SubcontractorAddress: "123 Main St, Springfield",
        ScopeOfWork: "Concrete foundations and footings",
        TradeCode: "03 - Concrete",
        OriginalValue: 150_000m,
        CurrentValue: 165_000m,
        BilledToDate: 80_000m,
        PaidToDate: 72_000m,
        RetainagePercent: 10m,
        RetainageHeld: 8_000m,
        ExecutionDate: new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc),
        StartDate: new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc),
        CompletionDate: new DateTime(2026, 6, 30, 0, 0, 0, DateTimeKind.Utc),
        ActualCompletionDate: null,
        Status: SubcontractStatus.InProgress,
        InsuranceExpirationDate: new DateTime(2027, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        InsuranceCurrent: true,
        LicenseNumber: "LIC-12345",
        Notes: "Good performance so far",
        CreatedAt: DateTime.UtcNow
    );

    #region Create

    [Fact]
    public async Task Create_Success_Returns201WithSubcontract()
    {
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.CreateSubcontractAsync(It.IsAny<CreateSubcontractCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var command = new CreateSubcontractCommand(
            ProjectId: TestProjectId,
            SubcontractNumber: "SC-2026-001",
            SubcontractorName: "ABC Concrete Inc",
            SubcontractorContact: "John Smith",
            SubcontractorEmail: "john@abcconcrete.com",
            SubcontractorPhone: "555-123-4567",
            SubcontractorAddress: "123 Main St, Springfield",
            ScopeOfWork: "Concrete foundations and footings",
            TradeCode: "03 - Concrete",
            OriginalValue: 150_000m,
            RetainagePercent: 10m,
            StartDate: new DateTime(2026, 2, 1),
            CompletionDate: new DateTime(2026, 6, 30),
            LicenseNumber: "LIC-12345",
            Notes: "Good performance so far");

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
            .Setup(s => s.CreateSubcontractAsync(It.IsAny<CreateSubcontractCommand>(), default))
            .ReturnsAsync(Result.Failure<SubcontractDto>("SubcontractNumber is required", "VALIDATION_ERROR"));

        var command = new CreateSubcontractCommand(
            ProjectId: TestProjectId,
            SubcontractNumber: "",
            SubcontractorName: "ABC Concrete",
            SubcontractorContact: null,
            SubcontractorEmail: null,
            SubcontractorPhone: null,
            SubcontractorAddress: null,
            ScopeOfWork: "Concrete work",
            TradeCode: null,
            OriginalValue: 0,
            RetainagePercent: 0,
            StartDate: null,
            CompletionDate: null,
            LicenseNumber: null,
            Notes: null);

        var result = await _controller.Create(command);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Create_DuplicateNumber_Returns400()
    {
        _serviceMock
            .Setup(s => s.CreateSubcontractAsync(It.IsAny<CreateSubcontractCommand>(), default))
            .ReturnsAsync(Result.Failure<SubcontractDto>("Subcontract number already exists", "DUPLICATE"));

        var command = new CreateSubcontractCommand(
            ProjectId: TestProjectId,
            SubcontractNumber: "SC-2026-001",
            SubcontractorName: "ABC Concrete",
            SubcontractorContact: null,
            SubcontractorEmail: null,
            SubcontractorPhone: null,
            SubcontractorAddress: null,
            ScopeOfWork: "Concrete work",
            TradeCode: null,
            OriginalValue: 100_000m,
            RetainagePercent: 10m,
            StartDate: null,
            CompletionDate: null,
            LicenseNumber: null,
            Notes: null);

        var result = await _controller.Create(command);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Create_ReturnsCreatedAtRouteWithCorrectId()
    {
        var subcontractId = Guid.NewGuid();
        var dto = CreateTestDto(subcontractId);
        _serviceMock
            .Setup(s => s.CreateSubcontractAsync(It.IsAny<CreateSubcontractCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var command = new CreateSubcontractCommand(
            ProjectId: TestProjectId,
            SubcontractNumber: "SC-2026-002",
            SubcontractorName: "XYZ Steel",
            SubcontractorContact: null,
            SubcontractorEmail: null,
            SubcontractorPhone: null,
            SubcontractorAddress: null,
            ScopeOfWork: "Structural steel",
            TradeCode: null,
            OriginalValue: 200_000m,
            RetainagePercent: 10m,
            StartDate: null,
            CompletionDate: null,
            LicenseNumber: null,
            Notes: null);

        var result = await _controller.Create(command);

        var created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        created.RouteValues.Should().ContainKey("id");
        created.RouteValues!["id"].Should().Be(subcontractId);
    }

    [Fact]
    public async Task Create_PassesAllFieldsToService()
    {
        _serviceMock
            .Setup(s => s.CreateSubcontractAsync(It.IsAny<CreateSubcontractCommand>(), default))
            .ReturnsAsync(Result.Success(CreateTestDto()));

        var command = new CreateSubcontractCommand(
            ProjectId: TestProjectId,
            SubcontractNumber: "SC-2026-010",
            SubcontractorName: "ABC Concrete Inc",
            SubcontractorContact: "John Smith",
            SubcontractorEmail: "john@abcconcrete.com",
            SubcontractorPhone: "555-123-4567",
            SubcontractorAddress: "123 Main St",
            ScopeOfWork: "Concrete foundations",
            TradeCode: "03 - Concrete",
            OriginalValue: 150_000m,
            RetainagePercent: 10m,
            StartDate: new DateTime(2026, 2, 1),
            CompletionDate: new DateTime(2026, 6, 30),
            LicenseNumber: "LIC-12345",
            Notes: "Priority subcontractor");

        await _controller.Create(command);

        _serviceMock.Verify(s => s.CreateSubcontractAsync(
            It.Is<CreateSubcontractCommand>(c =>
                c.ProjectId == TestProjectId &&
                c.SubcontractNumber == "SC-2026-010" &&
                c.SubcontractorName == "ABC Concrete Inc" &&
                c.SubcontractorContact == "John Smith" &&
                c.SubcontractorEmail == "john@abcconcrete.com" &&
                c.SubcontractorPhone == "555-123-4567" &&
                c.SubcontractorAddress == "123 Main St" &&
                c.ScopeOfWork == "Concrete foundations" &&
                c.TradeCode == "03 - Concrete" &&
                c.OriginalValue == 150_000m &&
                c.RetainagePercent == 10m &&
                c.StartDate == new DateTime(2026, 2, 1) &&
                c.CompletionDate == new DateTime(2026, 6, 30) &&
                c.LicenseNumber == "LIC-12345" &&
                c.Notes == "Priority subcontractor"),
            default), Times.Once);
    }

    [Fact]
    public async Task Create_ErrorResponse_ContainsErrorAndCode()
    {
        _serviceMock
            .Setup(s => s.CreateSubcontractAsync(It.IsAny<CreateSubcontractCommand>(), default))
            .ReturnsAsync(Result.Failure<SubcontractDto>("Name is required", "VALIDATION_ERROR"));

        var command = new CreateSubcontractCommand(
            ProjectId: TestProjectId,
            SubcontractNumber: "SC-001",
            SubcontractorName: "",
            SubcontractorContact: null,
            SubcontractorEmail: null,
            SubcontractorPhone: null,
            SubcontractorAddress: null,
            ScopeOfWork: "Work",
            TradeCode: null,
            OriginalValue: 100m,
            RetainagePercent: 0,
            StartDate: null,
            CompletionDate: null,
            LicenseNumber: null,
            Notes: null);

        var result = await _controller.Create(command);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
        // The controller returns new { error, code } directly
        bad.Value.Should().NotBeNull();
    }

    #endregion

    #region GetById

    [Fact]
    public async Task GetById_Found_Returns200()
    {
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.GetSubcontractAsync(TestId, default))
            .ReturnsAsync(Result.Success(dto));

        var result = await _controller.GetById(TestId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(dto);
    }

    [Fact]
    public async Task GetById_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.GetSubcontractAsync(TestId, default))
            .ReturnsAsync(Result.Failure<SubcontractDto>("Subcontract not found", "NOT_FOUND"));

        var result = await _controller.GetById(TestId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetById_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetSubcontractAsync(TestId, default))
            .ReturnsAsync(Result.Failure<SubcontractDto>("Database error", "DB_ERROR"));

        var result = await _controller.GetById(TestId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task GetById_ReturnsFullDtoFields()
    {
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.GetSubcontractAsync(TestId, default))
            .ReturnsAsync(Result.Success(dto));

        var result = await _controller.GetById(TestId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var returned = ok.Value.Should().BeOfType<SubcontractDto>().Subject;
        returned.Id.Should().Be(dto.Id);
        returned.ProjectId.Should().Be(TestProjectId);
        returned.SubcontractNumber.Should().Be("SC-2026-001");
        returned.SubcontractorName.Should().Be("ABC Concrete Inc");
        returned.OriginalValue.Should().Be(150_000m);
        returned.CurrentValue.Should().Be(165_000m);
        returned.RetainagePercent.Should().Be(10m);
        returned.Status.Should().Be(SubcontractStatus.InProgress);
    }

    #endregion

    #region List

    [Fact]
    public async Task List_Success_Returns200()
    {
        var pagedResult = new PagedResult<SubcontractDto>(
            new[] { CreateTestDto() }, TotalCount: 1, Page: 1, PageSize: 20);
        _serviceMock
            .Setup(s => s.ListSubcontractsAsync(It.IsAny<ListSubcontractsQuery>(), default))
            .ReturnsAsync(Result.Success(pagedResult));

        var result = await _controller.List(null, null, null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(pagedResult);
    }

    [Fact]
    public async Task List_WithFilters_PassesToService()
    {
        var pagedResult = new PagedResult<SubcontractDto>(
            Array.Empty<SubcontractDto>(), 0, 2, 25);
        _serviceMock
            .Setup(s => s.ListSubcontractsAsync(It.IsAny<ListSubcontractsQuery>(), default))
            .ReturnsAsync(Result.Success(pagedResult));

        await _controller.List(TestProjectId, SubcontractStatus.InProgress, "concrete", 2, 25);

        _serviceMock.Verify(s => s.ListSubcontractsAsync(
            It.Is<ListSubcontractsQuery>(q =>
                q.ProjectId == TestProjectId &&
                q.Status == SubcontractStatus.InProgress &&
                q.Search == "concrete" &&
                q.Page == 2 &&
                q.PageSize == 25),
            default), Times.Once);
    }

    [Fact]
    public async Task List_DefaultPagination_PassesDefaults()
    {
        var pagedResult = new PagedResult<SubcontractDto>(
            Array.Empty<SubcontractDto>(), 0, 1, 20);
        _serviceMock
            .Setup(s => s.ListSubcontractsAsync(It.IsAny<ListSubcontractsQuery>(), default))
            .ReturnsAsync(Result.Success(pagedResult));

        await _controller.List(null, null, null);

        _serviceMock.Verify(s => s.ListSubcontractsAsync(
            It.Is<ListSubcontractsQuery>(q =>
                q.Page == 1 &&
                q.PageSize == 20),
            default), Times.Once);
    }

    [Fact]
    public async Task List_Error_Returns400()
    {
        _serviceMock
            .Setup(s => s.ListSubcontractsAsync(It.IsAny<ListSubcontractsQuery>(), default))
            .ReturnsAsync(Result.Failure<PagedResult<SubcontractDto>>("Invalid query"));

        var result = await _controller.List(null, null, null);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task List_EmptyResults_Returns200WithEmptyList()
    {
        var pagedResult = new PagedResult<SubcontractDto>(
            Array.Empty<SubcontractDto>(), 0, 1, 20);
        _serviceMock
            .Setup(s => s.ListSubcontractsAsync(It.IsAny<ListSubcontractsQuery>(), default))
            .ReturnsAsync(Result.Success(pagedResult));

        var result = await _controller.List(null, null, null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var paged = ok.Value.Should().BeOfType<PagedResult<SubcontractDto>>().Subject;
        paged.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task List_NullFilters_PassesNullToQuery()
    {
        var pagedResult = new PagedResult<SubcontractDto>(
            Array.Empty<SubcontractDto>(), 0, 1, 20);
        _serviceMock
            .Setup(s => s.ListSubcontractsAsync(It.IsAny<ListSubcontractsQuery>(), default))
            .ReturnsAsync(Result.Success(pagedResult));

        await _controller.List(null, null, null);

        _serviceMock.Verify(s => s.ListSubcontractsAsync(
            It.Is<ListSubcontractsQuery>(q =>
                q.ProjectId == null &&
                q.Status == null &&
                q.Search == null),
            default), Times.Once);
    }

    #endregion

    #region Update

    [Fact]
    public async Task Update_Success_Returns200()
    {
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.UpdateSubcontractAsync(It.IsAny<UpdateSubcontractCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var command = new UpdateSubcontractCommand(
            Id: TestId,
            SubcontractNumber: "SC-2026-001",
            SubcontractorName: "ABC Concrete Inc",
            SubcontractorContact: "John Smith",
            SubcontractorEmail: "john@abcconcrete.com",
            SubcontractorPhone: "555-123-4567",
            SubcontractorAddress: "123 Main St",
            ScopeOfWork: "Updated scope of work",
            TradeCode: "03 - Concrete",
            OriginalValue: 150_000m,
            RetainagePercent: 10m,
            ExecutionDate: new DateTime(2026, 1, 15),
            StartDate: new DateTime(2026, 2, 1),
            CompletionDate: new DateTime(2026, 6, 30),
            Status: SubcontractStatus.InProgress,
            InsuranceExpirationDate: new DateTime(2027, 1, 1),
            InsuranceCurrent: true,
            LicenseNumber: "LIC-12345",
            Notes: "Updated notes");

        var result = await _controller.Update(TestId, command);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(dto);
    }

    [Fact]
    public async Task Update_IdMismatch_Returns400()
    {
        var routeId = Guid.NewGuid();
        var bodyId = Guid.NewGuid();

        var command = new UpdateSubcontractCommand(
            Id: bodyId,
            SubcontractNumber: "SC-001",
            SubcontractorName: "Test",
            SubcontractorContact: null,
            SubcontractorEmail: null,
            SubcontractorPhone: null,
            SubcontractorAddress: null,
            ScopeOfWork: "Work",
            TradeCode: null,
            OriginalValue: 100_000m,
            RetainagePercent: 10m,
            ExecutionDate: null,
            StartDate: null,
            CompletionDate: null,
            Status: SubcontractStatus.Draft,
            InsuranceExpirationDate: null,
            InsuranceCurrent: false,
            LicenseNumber: null,
            Notes: null);

        var result = await _controller.Update(routeId, command);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Update_IdMismatch_DoesNotCallService()
    {
        var routeId = Guid.NewGuid();
        var bodyId = Guid.NewGuid();

        var command = new UpdateSubcontractCommand(
            Id: bodyId,
            SubcontractNumber: "SC-001",
            SubcontractorName: "Test",
            SubcontractorContact: null,
            SubcontractorEmail: null,
            SubcontractorPhone: null,
            SubcontractorAddress: null,
            ScopeOfWork: "Work",
            TradeCode: null,
            OriginalValue: 100_000m,
            RetainagePercent: 10m,
            ExecutionDate: null,
            StartDate: null,
            CompletionDate: null,
            Status: SubcontractStatus.Draft,
            InsuranceExpirationDate: null,
            InsuranceCurrent: false,
            LicenseNumber: null,
            Notes: null);

        await _controller.Update(routeId, command);

        _serviceMock.Verify(
            s => s.UpdateSubcontractAsync(It.IsAny<UpdateSubcontractCommand>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Update_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.UpdateSubcontractAsync(It.IsAny<UpdateSubcontractCommand>(), default))
            .ReturnsAsync(Result.Failure<SubcontractDto>("Subcontract not found", "NOT_FOUND"));

        var command = new UpdateSubcontractCommand(
            Id: TestId,
            SubcontractNumber: "SC-001",
            SubcontractorName: "Test",
            SubcontractorContact: null,
            SubcontractorEmail: null,
            SubcontractorPhone: null,
            SubcontractorAddress: null,
            ScopeOfWork: "Work",
            TradeCode: null,
            OriginalValue: 100_000m,
            RetainagePercent: 10m,
            ExecutionDate: null,
            StartDate: null,
            CompletionDate: null,
            Status: SubcontractStatus.Draft,
            InsuranceExpirationDate: null,
            InsuranceCurrent: false,
            LicenseNumber: null,
            Notes: null);

        var result = await _controller.Update(TestId, command);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Update_Conflict_Returns409()
    {
        _serviceMock
            .Setup(s => s.UpdateSubcontractAsync(It.IsAny<UpdateSubcontractCommand>(), default))
            .ReturnsAsync(Result.Failure<SubcontractDto>("Concurrent modification detected", "CONFLICT"));

        var command = new UpdateSubcontractCommand(
            Id: TestId,
            SubcontractNumber: "SC-001",
            SubcontractorName: "Test",
            SubcontractorContact: null,
            SubcontractorEmail: null,
            SubcontractorPhone: null,
            SubcontractorAddress: null,
            ScopeOfWork: "Work",
            TradeCode: null,
            OriginalValue: 100_000m,
            RetainagePercent: 10m,
            ExecutionDate: null,
            StartDate: null,
            CompletionDate: null,
            Status: SubcontractStatus.Draft,
            InsuranceExpirationDate: null,
            InsuranceCurrent: false,
            LicenseNumber: null,
            Notes: null);

        var result = await _controller.Update(TestId, command);

        // Controller uses this.Error(409, ...) which returns ObjectResult, not ConflictObjectResult
        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task Update_ValidationError_Returns400()
    {
        _serviceMock
            .Setup(s => s.UpdateSubcontractAsync(It.IsAny<UpdateSubcontractCommand>(), default))
            .ReturnsAsync(Result.Failure<SubcontractDto>("SubcontractNumber is required", "VALIDATION_ERROR"));

        var command = new UpdateSubcontractCommand(
            Id: TestId,
            SubcontractNumber: "",
            SubcontractorName: "Test",
            SubcontractorContact: null,
            SubcontractorEmail: null,
            SubcontractorPhone: null,
            SubcontractorAddress: null,
            ScopeOfWork: "Work",
            TradeCode: null,
            OriginalValue: 0,
            RetainagePercent: 0,
            ExecutionDate: null,
            StartDate: null,
            CompletionDate: null,
            Status: SubcontractStatus.Draft,
            InsuranceExpirationDate: null,
            InsuranceCurrent: false,
            LicenseNumber: null,
            Notes: null);

        var result = await _controller.Update(TestId, command);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Update_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.UpdateSubcontractAsync(It.IsAny<UpdateSubcontractCommand>(), default))
            .ReturnsAsync(Result.Failure<SubcontractDto>("Unknown error", "UNKNOWN"));

        var command = new UpdateSubcontractCommand(
            Id: TestId,
            SubcontractNumber: "SC-001",
            SubcontractorName: "Test",
            SubcontractorContact: null,
            SubcontractorEmail: null,
            SubcontractorPhone: null,
            SubcontractorAddress: null,
            ScopeOfWork: "Work",
            TradeCode: null,
            OriginalValue: 100_000m,
            RetainagePercent: 10m,
            ExecutionDate: null,
            StartDate: null,
            CompletionDate: null,
            Status: SubcontractStatus.Draft,
            InsuranceExpirationDate: null,
            InsuranceCurrent: false,
            LicenseNumber: null,
            Notes: null);

        var result = await _controller.Update(TestId, command);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Update_PassesAllFieldsToService()
    {
        _serviceMock
            .Setup(s => s.UpdateSubcontractAsync(It.IsAny<UpdateSubcontractCommand>(), default))
            .ReturnsAsync(Result.Success(CreateTestDto()));

        var command = new UpdateSubcontractCommand(
            Id: TestId,
            SubcontractNumber: "SC-2026-099",
            SubcontractorName: "Updated Contractor LLC",
            SubcontractorContact: "Jane Doe",
            SubcontractorEmail: "jane@updated.com",
            SubcontractorPhone: "555-987-6543",
            SubcontractorAddress: "456 Oak Ave",
            ScopeOfWork: "Expanded concrete and masonry work",
            TradeCode: "04 - Masonry",
            OriginalValue: 250_000m,
            RetainagePercent: 5m,
            ExecutionDate: new DateTime(2026, 1, 20),
            StartDate: new DateTime(2026, 3, 1),
            CompletionDate: new DateTime(2026, 9, 30),
            Status: SubcontractStatus.Executed,
            InsuranceExpirationDate: new DateTime(2027, 6, 1),
            InsuranceCurrent: true,
            LicenseNumber: "LIC-99999",
            Notes: "Updated notes");

        await _controller.Update(TestId, command);

        _serviceMock.Verify(s => s.UpdateSubcontractAsync(
            It.Is<UpdateSubcontractCommand>(c =>
                c.Id == TestId &&
                c.SubcontractNumber == "SC-2026-099" &&
                c.SubcontractorName == "Updated Contractor LLC" &&
                c.SubcontractorContact == "Jane Doe" &&
                c.SubcontractorEmail == "jane@updated.com" &&
                c.SubcontractorPhone == "555-987-6543" &&
                c.SubcontractorAddress == "456 Oak Ave" &&
                c.ScopeOfWork == "Expanded concrete and masonry work" &&
                c.TradeCode == "04 - Masonry" &&
                c.OriginalValue == 250_000m &&
                c.RetainagePercent == 5m &&
                c.ExecutionDate == new DateTime(2026, 1, 20) &&
                c.StartDate == new DateTime(2026, 3, 1) &&
                c.CompletionDate == new DateTime(2026, 9, 30) &&
                c.Status == SubcontractStatus.Executed &&
                c.InsuranceExpirationDate == new DateTime(2027, 6, 1) &&
                c.InsuranceCurrent == true &&
                c.LicenseNumber == "LIC-99999" &&
                c.Notes == "Updated notes"),
            default), Times.Once);
    }

    [Fact]
    public async Task Update_StatusTransition_DraftToExecuted_Returns200()
    {
        var dto = CreateTestDto() with { Status = SubcontractStatus.Executed };
        _serviceMock
            .Setup(s => s.UpdateSubcontractAsync(It.IsAny<UpdateSubcontractCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var command = new UpdateSubcontractCommand(
            Id: TestId,
            SubcontractNumber: "SC-2026-001",
            SubcontractorName: "ABC Concrete Inc",
            SubcontractorContact: null,
            SubcontractorEmail: null,
            SubcontractorPhone: null,
            SubcontractorAddress: null,
            ScopeOfWork: "Concrete work",
            TradeCode: null,
            OriginalValue: 150_000m,
            RetainagePercent: 10m,
            ExecutionDate: new DateTime(2026, 1, 15),
            StartDate: null,
            CompletionDate: null,
            Status: SubcontractStatus.Executed,
            InsuranceExpirationDate: null,
            InsuranceCurrent: false,
            LicenseNumber: null,
            Notes: null);

        var result = await _controller.Update(TestId, command);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var returnedDto = ok.Value.Should().BeOfType<SubcontractDto>().Subject;
        returnedDto.Status.Should().Be(SubcontractStatus.Executed);
    }

    #endregion

    #region Delete

    [Fact]
    public async Task Delete_Success_Returns204()
    {
        _serviceMock
            .Setup(s => s.DeleteSubcontractAsync(TestId, default))
            .ReturnsAsync(Result.Success());

        var result = await _controller.Delete(TestId);

        result.Should().BeOfType<NoContentResult>();
    }

    [Fact]
    public async Task Delete_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.DeleteSubcontractAsync(TestId, default))
            .ReturnsAsync(Result.Failure("Subcontract not found", "NOT_FOUND"));

        var result = await _controller.Delete(TestId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Delete_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.DeleteSubcontractAsync(TestId, default))
            .ReturnsAsync(Result.Failure("Cannot delete subcontract with active change orders", "HAS_DEPENDENCIES"));

        var result = await _controller.Delete(TestId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Delete_PassesIdToService()
    {
        var deleteId = Guid.NewGuid();
        _serviceMock
            .Setup(s => s.DeleteSubcontractAsync(deleteId, default))
            .ReturnsAsync(Result.Success());

        await _controller.Delete(deleteId);

        _serviceMock.Verify(s => s.DeleteSubcontractAsync(deleteId, default), Times.Once);
    }

    #endregion
}
