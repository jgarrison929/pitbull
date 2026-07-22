using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Core.CQRS;
using Pitbull.RFIs.Domain;
using Pitbull.RFIs.Features;
using Pitbull.RFIs.Features.CreateRfi;
using Pitbull.RFIs.Features.ListRfis;
using Pitbull.RFIs.Features.UpdateRfi;
using Pitbull.RFIs.Services;

namespace Pitbull.Tests.Unit.Api;

public class RfisControllerTests
{
    private readonly Mock<IRfiService> _serviceMock;
    private readonly RfisController _controller;

    private static readonly Guid TestProjectId = Guid.NewGuid();
    private static readonly Guid TestRfiId = Guid.NewGuid();

    public RfisControllerTests()
    {
        _serviceMock = new Mock<IRfiService>();
        _controller = new RfisController(_serviceMock.Object);
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
    }

    private static RfiDto CreateTestDto(Guid? id = null, Guid? projectId = null) => new(
        Id: id ?? TestRfiId,
        Number: 1,
        Subject: "Foundation Depth Clarification",
        Question: "Drawing A2.1 shows 36\" depth but specification calls for 42\". Please clarify.",
        Answer: null,
        Status: RfiStatus.Open,
        Priority: RfiPriority.High,
        DueDate: new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc),
        AnsweredAt: null,
        ClosedAt: null,
        ProjectId: projectId ?? TestProjectId,
        BallInCourtUserId: Guid.NewGuid(),
        BallInCourtName: "John Architect",
        AssignedToUserId: Guid.NewGuid(),
        AssignedToName: "Jane Engineer",
        CreatedByName: "Bob Builder",
        CreatedAt: DateTime.UtcNow,
        SpecSection: "03300",
        DrawingReferences: new List<string> { "A2.1", "S3.2" },
        HasCostImpact: false,
        EstimatedCostImpact: null,
        EstimatedDelayDays: null
    );

    private static RfiCostImpactDto CreateTestCostImpactDto() => new(
        RfiId: TestRfiId,
        RfiNumber: 1,
        Subject: "Foundation Depth Clarification",
        Status: "Answered",
        DaysOpen: 14,
        ResponseDelayDays: 3,
        CreatedAt: DateTime.UtcNow.AddDays(-14),
        DueDate: new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc),
        AnsweredAt: DateTime.UtcNow.AddDays(-3),
        ClosedAt: null,
        DirectCost: 45_000m,
        DelayCost: 18_000m,
        TotalCost: 63_000m,
        ChangeOrders: new List<LinkedChangeOrderDto>
        {
            new(
                Id: Guid.NewGuid(),
                ChangeOrderNumber: "CO-001",
                Title: "Foundation depth change",
                Amount: 45_000m,
                DelayDays: 5,
                DelayCost: 18_000m,
                Status: "Approved",
                ApprovedDate: DateTime.UtcNow.AddDays(-1))
        },
        Timeline: new List<RfiTimelineEventDto>
        {
            new(DateTime.UtcNow.AddDays(-14), "Created", "Bob Builder", "RFI submitted"),
            new(DateTime.UtcNow.AddDays(-3), "Answered", "John Architect", "Response provided")
        }
    );

    #region Create

    [Fact]
    public async Task Create_Success_Returns201WithRfi()
    {
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.CreateRfiAsync(It.IsAny<CreateRfiCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var request = new CreateRfiRequest(
            Subject: "Foundation Depth Clarification",
            Question: "Drawing A2.1 shows 36\" depth but specification calls for 42\". Please clarify.",
            Priority: RfiPriority.High,
            DueDate: new DateTime(2026, 3, 1),
            BallInCourtName: "John Architect");

        var result = await _controller.Create(TestProjectId, request);

        var created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        created.StatusCode.Should().Be(201);
        created.Value.Should().Be(dto);
        created.ActionName.Should().Be("GetById");
    }

    [Fact]
    public async Task Create_ValidationError_Returns400()
    {
        _serviceMock
            .Setup(s => s.CreateRfiAsync(It.IsAny<CreateRfiCommand>(), default))
            .ReturnsAsync(Result.Failure<RfiDto>("Subject is required", "VALIDATION_ERROR"));

        var request = new CreateRfiRequest(
            Subject: "",
            Question: "Some question");

        var result = await _controller.Create(TestProjectId, request);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Create_ReturnsCreatedAtRouteWithCorrectIds()
    {
        var rfiId = Guid.NewGuid();
        var dto = CreateTestDto(rfiId);
        _serviceMock
            .Setup(s => s.CreateRfiAsync(It.IsAny<CreateRfiCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var request = new CreateRfiRequest(
            Subject: "Test RFI",
            Question: "Test question");

        var result = await _controller.Create(TestProjectId, request);

        var created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        created.RouteValues.Should().ContainKey("id");
        created.RouteValues!["id"].Should().Be(rfiId);
        created.RouteValues.Should().ContainKey("projectId");
        created.RouteValues!["projectId"].Should().Be(TestProjectId);
    }

    [Fact]
    public async Task Create_PassesAllFieldsToService()
    {
        _serviceMock
            .Setup(s => s.CreateRfiAsync(It.IsAny<CreateRfiCommand>(), default))
            .ReturnsAsync(Result.Success(CreateTestDto()));

        var assignedToUserId = Guid.NewGuid();
        var ballInCourtUserId = Guid.NewGuid();

        var request = new CreateRfiRequest(
            Subject: "Foundation Depth",
            Question: "Please clarify depth.",
            Priority: RfiPriority.High,
            DueDate: new DateTime(2026, 3, 1),
            AssignedToUserId: assignedToUserId,
            AssignedToName: "Jane Engineer",
            BallInCourtUserId: ballInCourtUserId,
            BallInCourtName: "John Architect",
            CreatedByName: "Bob Builder");

        await _controller.Create(TestProjectId, request);

        _serviceMock.Verify(s => s.CreateRfiAsync(
            It.Is<CreateRfiCommand>(c =>
                c.ProjectId == TestProjectId &&
                c.Subject == "Foundation Depth" &&
                c.Question == "Please clarify depth." &&
                c.Priority == RfiPriority.High &&
                c.DueDate == new DateTime(2026, 3, 1) &&
                c.AssignedToUserId == assignedToUserId &&
                c.AssignedToName == "Jane Engineer" &&
                c.BallInCourtUserId == ballInCourtUserId &&
                c.BallInCourtName == "John Architect" &&
                c.CreatedByName == "Bob Builder"),
            default), Times.Once);
    }

    [Fact]
    public async Task Create_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.CreateRfiAsync(It.IsAny<CreateRfiCommand>(), default))
            .ReturnsAsync(Result.Failure<RfiDto>("Database error", "DB_ERROR"));

        var request = new CreateRfiRequest(
            Subject: "Test",
            Question: "Test");

        var result = await _controller.Create(TestProjectId, request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region GetById

    [Fact]
    public async Task GetById_Found_Returns200()
    {
        var dto = CreateTestDto(TestRfiId, TestProjectId);
        _serviceMock
            .Setup(s => s.GetRfiAsync(TestRfiId, default))
            .ReturnsAsync(Result.Success(dto));

        var result = await _controller.GetById(TestProjectId, TestRfiId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(dto);
    }

    [Fact]
    public async Task GetById_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.GetRfiAsync(TestRfiId, default))
            .ReturnsAsync(Result.Failure<RfiDto>("RFI not found", "NOT_FOUND"));

        var result = await _controller.GetById(TestProjectId, TestRfiId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetById_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetRfiAsync(TestRfiId, default))
            .ReturnsAsync(Result.Failure<RfiDto>("Database error", "DB_ERROR"));

        var result = await _controller.GetById(TestProjectId, TestRfiId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task GetById_WrongProject_Returns404()
    {
        // RFI exists but belongs to a different project
        var differentProjectId = Guid.NewGuid();
        var dto = CreateTestDto(TestRfiId, differentProjectId);
        _serviceMock
            .Setup(s => s.GetRfiAsync(TestRfiId, default))
            .ReturnsAsync(Result.Success(dto));

        var result = await _controller.GetById(TestProjectId, TestRfiId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetById_CorrectProject_Returns200()
    {
        var dto = CreateTestDto(TestRfiId, TestProjectId);
        _serviceMock
            .Setup(s => s.GetRfiAsync(TestRfiId, default))
            .ReturnsAsync(Result.Success(dto));

        var result = await _controller.GetById(TestProjectId, TestRfiId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(dto);
    }

    #endregion

    #region List

    [Fact]
    public async Task List_Success_Returns200()
    {
        var pagedResult = new PagedResult<RfiDto>(
            new[] { CreateTestDto() }, TotalCount: 1, Page: 1, PageSize: 25);
        _serviceMock
            .Setup(s => s.GetRfisAsync(It.IsAny<ListRfisQuery>(), default))
            .ReturnsAsync(Result.Success(pagedResult));

        var result = await _controller.List(TestProjectId, null, null, null, null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(pagedResult);
    }

    [Fact]
    public async Task List_WithFilters_PassesToService()
    {
        var ballInCourtUserId = Guid.NewGuid();
        var pagedResult = new PagedResult<RfiDto>(
            Array.Empty<RfiDto>(), 0, 2, 50);
        _serviceMock
            .Setup(s => s.GetRfisAsync(It.IsAny<ListRfisQuery>(), default))
            .ReturnsAsync(Result.Success(pagedResult));

        await _controller.List(TestProjectId, RfiStatus.Open, RfiPriority.High, ballInCourtUserId, "foundation", 2, 50);

        _serviceMock.Verify(s => s.GetRfisAsync(
            It.Is<ListRfisQuery>(q =>
                q.ProjectId == TestProjectId &&
                q.Status == RfiStatus.Open &&
                q.Priority == RfiPriority.High &&
                q.BallInCourtUserId == ballInCourtUserId &&
                q.Search == "foundation" &&
                q.Page == 2 &&
                q.PageSize == 50),
            default), Times.Once);
    }

    [Fact]
    public async Task List_DefaultPagination_PassesDefaults()
    {
        var pagedResult = new PagedResult<RfiDto>(
            Array.Empty<RfiDto>(), 0, 1, 25);
        _serviceMock
            .Setup(s => s.GetRfisAsync(It.IsAny<ListRfisQuery>(), default))
            .ReturnsAsync(Result.Success(pagedResult));

        await _controller.List(TestProjectId, null, null, null, null);

        _serviceMock.Verify(s => s.GetRfisAsync(
            It.Is<ListRfisQuery>(q =>
                q.Page == 1 &&
                q.PageSize == 25),
            default), Times.Once);
    }

    [Fact]
    public async Task List_Error_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetRfisAsync(It.IsAny<ListRfisQuery>(), default))
            .ReturnsAsync(Result.Failure<PagedResult<RfiDto>>("Invalid query"));

        var result = await _controller.List(TestProjectId, null, null, null, null);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task List_EmptyResults_Returns200WithEmptyList()
    {
        var pagedResult = new PagedResult<RfiDto>(
            Array.Empty<RfiDto>(), 0, 1, 25);
        _serviceMock
            .Setup(s => s.GetRfisAsync(It.IsAny<ListRfisQuery>(), default))
            .ReturnsAsync(Result.Success(pagedResult));

        var result = await _controller.List(TestProjectId, null, null, null, null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var paged = ok.Value.Should().BeOfType<PagedResult<RfiDto>>().Subject;
        paged.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task List_ViewMobile_ReturnsSlimDtoWithoutHeavyFields()
    {
        var full = CreateTestDto(TestRfiId, TestProjectId);
        var pagedResult = new PagedResult<RfiDto>(new[] { full }, 1, 1, 25);
        _serviceMock
            .Setup(s => s.GetRfisAsync(It.IsAny<ListRfisQuery>(), default))
            .ReturnsAsync(Result.Success(pagedResult));

        var result = await _controller.List(TestProjectId, null, null, null, null, 1, 25, "mobile");

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var paged = ok.Value.Should().BeOfType<PagedResult<RfiMobileListItemDto>>().Subject;
        paged.TotalCount.Should().Be(1);
        paged.Items.Should().HaveCount(1);
        var row = paged.Items[0];
        row.Id.Should().Be(TestRfiId);
        row.ProjectId.Should().Be(TestProjectId);
        row.Subject.Should().Be(full.Subject);
        row.Number.Should().Be(full.Number);
        row.Status.Should().Be(full.Status);
        // Same authz path — service still called
        _serviceMock.Verify(s => s.GetRfisAsync(It.IsAny<ListRfisQuery>(), default), Times.Once);
    }

    [Fact]
    public async Task List_ViewMobile_Empty_ReturnsHonestEmptyPage()
    {
        var pagedResult = new PagedResult<RfiDto>(Array.Empty<RfiDto>(), 0, 1, 25);
        _serviceMock
            .Setup(s => s.GetRfisAsync(It.IsAny<ListRfisQuery>(), default))
            .ReturnsAsync(Result.Success(pagedResult));

        var result = await _controller.List(TestProjectId, null, null, null, null, 1, 25, "mobile");

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var paged = ok.Value.Should().BeOfType<PagedResult<RfiMobileListItemDto>>().Subject;
        paged.Items.Should().BeEmpty();
        paged.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task List_ViewMobile_Forbidden_Returns403()
    {
        _serviceMock
            .Setup(s => s.GetRfisAsync(It.IsAny<ListRfisQuery>(), default))
            .ReturnsAsync(Result.Failure<PagedResult<RfiDto>>("Not authorized to access this project", "FORBIDDEN"));

        var result = await _controller.List(TestProjectId, null, null, null, null, 1, 25, "mobile");

        result.Should().BeOfType<ObjectResult>()
            .Which.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }

    #endregion

    #region Update

    [Fact]
    public async Task Update_Success_Returns200()
    {
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.UpdateRfiAsync(It.IsAny<UpdateRfiCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var request = new UpdateRfiRequest(
            Subject: "Updated Subject",
            Question: "Updated question",
            Answer: "The answer is 42\"",
            Status: RfiStatus.Answered,
            Priority: RfiPriority.High);

        var result = await _controller.Update(TestProjectId, TestRfiId, request);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(dto);
    }

    [Fact]
    public async Task Update_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.UpdateRfiAsync(It.IsAny<UpdateRfiCommand>(), default))
            .ReturnsAsync(Result.Failure<RfiDto>("RFI not found", "NOT_FOUND"));

        var request = new UpdateRfiRequest(
            Subject: "Test",
            Question: "Test",
            Answer: null,
            Status: RfiStatus.Open,
            Priority: RfiPriority.Normal);

        var result = await _controller.Update(TestProjectId, TestRfiId, request);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Update_Conflict_Returns409()
    {
        _serviceMock
            .Setup(s => s.UpdateRfiAsync(It.IsAny<UpdateRfiCommand>(), default))
            .ReturnsAsync(Result.Failure<RfiDto>("Concurrent modification detected", "CONFLICT"));

        var request = new UpdateRfiRequest(
            Subject: "Test",
            Question: "Test",
            Answer: null,
            Status: RfiStatus.Open,
            Priority: RfiPriority.Normal);

        var result = await _controller.Update(TestProjectId, TestRfiId, request);

        var conflict = result.Should().BeOfType<ConflictObjectResult>().Subject;
        conflict.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task Update_ValidationError_Returns400()
    {
        _serviceMock
            .Setup(s => s.UpdateRfiAsync(It.IsAny<UpdateRfiCommand>(), default))
            .ReturnsAsync(Result.Failure<RfiDto>("Subject is required", "VALIDATION_ERROR"));

        var request = new UpdateRfiRequest(
            Subject: "",
            Question: "Test",
            Answer: null,
            Status: RfiStatus.Open,
            Priority: RfiPriority.Normal);

        var result = await _controller.Update(TestProjectId, TestRfiId, request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Update_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.UpdateRfiAsync(It.IsAny<UpdateRfiCommand>(), default))
            .ReturnsAsync(Result.Failure<RfiDto>("Unknown error", "UNKNOWN"));

        var request = new UpdateRfiRequest(
            Subject: "Test",
            Question: "Test",
            Answer: null,
            Status: RfiStatus.Open,
            Priority: RfiPriority.Normal);

        var result = await _controller.Update(TestProjectId, TestRfiId, request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Update_PassesAllFieldsToService()
    {
        _serviceMock
            .Setup(s => s.UpdateRfiAsync(It.IsAny<UpdateRfiCommand>(), default))
            .ReturnsAsync(Result.Success(CreateTestDto()));

        var assignedToUserId = Guid.NewGuid();
        var ballInCourtUserId = Guid.NewGuid();

        var request = new UpdateRfiRequest(
            Subject: "Updated Foundation Depth",
            Question: "Updated question about depth",
            Answer: "Use 42\" as specified",
            Status: RfiStatus.Answered,
            Priority: RfiPriority.High,
            DueDate: new DateTime(2026, 4, 1),
            AssignedToUserId: assignedToUserId,
            AssignedToName: "Jane Engineer",
            BallInCourtUserId: ballInCourtUserId,
            BallInCourtName: "John Architect");

        await _controller.Update(TestProjectId, TestRfiId, request);

        _serviceMock.Verify(s => s.UpdateRfiAsync(
            It.Is<UpdateRfiCommand>(c =>
                c.Id == TestRfiId &&
                c.ProjectId == TestProjectId &&
                c.Subject == "Updated Foundation Depth" &&
                c.Question == "Updated question about depth" &&
                c.Answer == "Use 42\" as specified" &&
                c.Status == RfiStatus.Answered &&
                c.Priority == RfiPriority.High &&
                c.DueDate == new DateTime(2026, 4, 1) &&
                c.AssignedToUserId == assignedToUserId &&
                c.AssignedToName == "Jane Engineer" &&
                c.BallInCourtUserId == ballInCourtUserId &&
                c.BallInCourtName == "John Architect"),
            default), Times.Once);
    }

    [Fact]
    public async Task Update_StatusTransition_OpenToAnswered_Returns200()
    {
        var dto = CreateTestDto() with { Status = RfiStatus.Answered, Answer = "Answer provided" };
        _serviceMock
            .Setup(s => s.UpdateRfiAsync(It.IsAny<UpdateRfiCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var request = new UpdateRfiRequest(
            Subject: "Test",
            Question: "Test",
            Answer: "Answer provided",
            Status: RfiStatus.Answered,
            Priority: RfiPriority.Normal);

        var result = await _controller.Update(TestProjectId, TestRfiId, request);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var returnedDto = ok.Value.Should().BeOfType<RfiDto>().Subject;
        returnedDto.Status.Should().Be(RfiStatus.Answered);
    }

    #endregion

    #region Delete

    [Fact]
    public async Task Delete_Success_Returns204AndCallsService()
    {
        var dto = CreateTestDto(TestRfiId, TestProjectId);
        _serviceMock
            .Setup(s => s.GetRfiAsync(TestRfiId, default))
            .ReturnsAsync(Result.Success(dto));
        _serviceMock
            .Setup(s => s.DeleteRfiAsync(TestRfiId, default))
            .ReturnsAsync(Result.Success());

        var result = await _controller.Delete(TestProjectId, TestRfiId);

        result.Should().BeOfType<NoContentResult>();
        _serviceMock.Verify(s => s.DeleteRfiAsync(TestRfiId, default), Times.Once);
    }

    [Fact]
    public async Task Delete_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.GetRfiAsync(TestRfiId, default))
            .ReturnsAsync(Result.Failure<RfiDto>("RFI not found", "NOT_FOUND"));

        var result = await _controller.Delete(TestProjectId, TestRfiId);

        result.Should().BeOfType<NotFoundObjectResult>();
        _serviceMock.Verify(s => s.DeleteRfiAsync(It.IsAny<Guid>(), default), Times.Never);
    }

    [Fact]
    public async Task Delete_WrongProject_Returns404WithoutDeleting()
    {
        var otherProject = Guid.NewGuid();
        var dto = CreateTestDto(TestRfiId, otherProject);
        _serviceMock
            .Setup(s => s.GetRfiAsync(TestRfiId, default))
            .ReturnsAsync(Result.Success(dto));

        var result = await _controller.Delete(TestProjectId, TestRfiId);

        result.Should().BeOfType<NotFoundObjectResult>();
        _serviceMock.Verify(s => s.DeleteRfiAsync(It.IsAny<Guid>(), default), Times.Never);
    }

    [Fact]
    public async Task Delete_ServiceFailureAfterLookup_ReturnsMappedError()
    {
        var dto = CreateTestDto(TestRfiId, TestProjectId);
        _serviceMock
            .Setup(s => s.GetRfiAsync(TestRfiId, default))
            .ReturnsAsync(Result.Success(dto));
        _serviceMock
            .Setup(s => s.DeleteRfiAsync(TestRfiId, default))
            .ReturnsAsync(Result.Failure("Failed to delete RFI", "DATABASE_ERROR"));

        var result = await _controller.Delete(TestProjectId, TestRfiId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region GetCostImpact

    [Fact]
    public async Task GetCostImpact_Success_Returns200()
    {
        var costImpact = CreateTestCostImpactDto();
        _serviceMock
            .Setup(s => s.GetRfiCostImpactAsync(TestRfiId, default))
            .ReturnsAsync(Result.Success(costImpact));

        var result = await _controller.GetCostImpact(TestProjectId, TestRfiId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(costImpact);
    }

    [Fact]
    public async Task GetCostImpact_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.GetRfiCostImpactAsync(TestRfiId, default))
            .ReturnsAsync(Result.Failure<RfiCostImpactDto>("RFI not found", "NOT_FOUND"));

        var result = await _controller.GetCostImpact(TestProjectId, TestRfiId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetCostImpact_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetRfiCostImpactAsync(TestRfiId, default))
            .ReturnsAsync(Result.Failure<RfiCostImpactDto>("Database error", "DB_ERROR"));

        var result = await _controller.GetCostImpact(TestProjectId, TestRfiId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task GetCostImpact_ReturnsCostData()
    {
        var costImpact = CreateTestCostImpactDto();
        _serviceMock
            .Setup(s => s.GetRfiCostImpactAsync(TestRfiId, default))
            .ReturnsAsync(Result.Success(costImpact));

        var result = await _controller.GetCostImpact(TestProjectId, TestRfiId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = ok.Value.Should().BeOfType<RfiCostImpactDto>().Subject;
        dto.DirectCost.Should().Be(45_000m);
        dto.DelayCost.Should().Be(18_000m);
        dto.TotalCost.Should().Be(63_000m);
        dto.ChangeOrders.Should().HaveCount(1);
        dto.Timeline.Should().HaveCount(2);
    }

    #endregion
}
