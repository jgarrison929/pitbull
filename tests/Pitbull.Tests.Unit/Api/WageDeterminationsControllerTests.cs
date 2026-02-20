using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Billing.Features.WageDeterminations;
using Pitbull.Billing.Services;
using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;

namespace Pitbull.Tests.Unit.Api;

public class WageDeterminationsControllerTests
{
    private readonly Mock<IWageDeterminationService> _serviceMock;
    private readonly WageDeterminationsController _controller;

    private static readonly Guid TestId = Guid.NewGuid();
    private static readonly Guid TestProjectId = Guid.NewGuid();
    private static readonly Guid TestClassificationId = Guid.NewGuid();

    public WageDeterminationsControllerTests()
    {
        _serviceMock = new Mock<IWageDeterminationService>();
        _controller = new WageDeterminationsController(_serviceMock.Object)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
    }

    [Fact]
    public async Task List_Returns200_WhenSuccessful()
    {
        var payload = new ListWageDeterminationsResult([CreateDto()], 1, 1, 25, 1);
        _serviceMock.Setup(x => x.ListAsync(It.IsAny<ListWageDeterminationsQuery>(), default))
            .ReturnsAsync(Result.Success(payload));

        IActionResult result = await _controller.List(TestProjectId, WageDeterminationStatus.Active, 1, 25);

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task List_Returns400_WhenServiceFails()
    {
        _serviceMock.Setup(x => x.ListAsync(It.IsAny<ListWageDeterminationsQuery>(), default))
            .ReturnsAsync(Result.Failure<ListWageDeterminationsResult>("bad", "BAD"));

        IActionResult result = await _controller.List(null, null, 1, 25);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task List_PassesFiltersToService()
    {
        _serviceMock.Setup(x => x.ListAsync(It.IsAny<ListWageDeterminationsQuery>(), default))
            .ReturnsAsync(Result.Success(new ListWageDeterminationsResult([], 0, 2, 10, 0)));

        await _controller.List(TestProjectId, WageDeterminationStatus.Active, 2, 10);

        _serviceMock.Verify(x => x.ListAsync(
            It.Is<ListWageDeterminationsQuery>(q =>
                q.ProjectId == TestProjectId && q.Status == WageDeterminationStatus.Active && q.Page == 2 && q.PageSize == 10),
            default), Times.Once);
    }

    [Fact]
    public async Task GetById_Returns200_WhenFound()
    {
        _serviceMock.Setup(x => x.GetAsync(TestId, default)).ReturnsAsync(Result.Success(CreateDto()));

        IActionResult result = await _controller.GetById(TestId);

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task GetById_Returns404_WhenNotFound()
    {
        _serviceMock.Setup(x => x.GetAsync(TestId, default)).ReturnsAsync(Result.Failure<WageDeterminationDto>("missing", "NOT_FOUND"));

        IActionResult result = await _controller.GetById(TestId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetById_Returns400_WhenUnexpectedFailure()
    {
        _serviceMock.Setup(x => x.GetAsync(TestId, default)).ReturnsAsync(Result.Failure<WageDeterminationDto>("bad", "BAD"));

        IActionResult result = await _controller.GetById(TestId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Create_Returns201_WhenSuccessful()
    {
        _serviceMock.Setup(x => x.CreateAsync(It.IsAny<CreateWageDeterminationCommand>(), default)).ReturnsAsync(Result.Success(CreateDto()));

        IActionResult result = await _controller.Create(CreateRequest());

        var created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        created.StatusCode.Should().Be(201);
    }

    [Fact]
    public async Task Create_Returns400_WhenServiceFails()
    {
        _serviceMock.Setup(x => x.CreateAsync(It.IsAny<CreateWageDeterminationCommand>(), default))
            .ReturnsAsync(Result.Failure<WageDeterminationDto>("validation", "VALIDATION_ERROR"));

        IActionResult result = await _controller.Create(CreateRequest());

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Update_Returns200_WhenSuccessful()
    {
        _serviceMock.Setup(x => x.UpdateAsync(It.IsAny<UpdateWageDeterminationCommand>(), default)).ReturnsAsync(Result.Success(CreateDto()));

        IActionResult result = await _controller.Update(TestId, new UpdateWageDeterminationRequest(Status: WageDeterminationStatus.Superseded));

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task Update_Returns404_WhenNotFound()
    {
        _serviceMock.Setup(x => x.UpdateAsync(It.IsAny<UpdateWageDeterminationCommand>(), default))
            .ReturnsAsync(Result.Failure<WageDeterminationDto>("missing", "NOT_FOUND"));

        IActionResult result = await _controller.Update(TestId, new UpdateWageDeterminationRequest());

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Update_Returns400_WhenOtherError()
    {
        _serviceMock.Setup(x => x.UpdateAsync(It.IsAny<UpdateWageDeterminationCommand>(), default))
            .ReturnsAsync(Result.Failure<WageDeterminationDto>("bad", "BAD"));

        IActionResult result = await _controller.Update(TestId, new UpdateWageDeterminationRequest());

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Delete_Returns204_WhenSuccessful()
    {
        _serviceMock.Setup(x => x.DeleteAsync(TestId, default)).ReturnsAsync(Result.Success());

        IActionResult result = await _controller.Delete(TestId);

        result.Should().BeOfType<NoContentResult>();
    }

    [Fact]
    public async Task Delete_Returns404_WhenNotFound()
    {
        _serviceMock.Setup(x => x.DeleteAsync(TestId, default)).ReturnsAsync(Result.Failure("missing", "NOT_FOUND"));

        IActionResult result = await _controller.Delete(TestId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Delete_Returns400_WhenOtherFailure()
    {
        _serviceMock.Setup(x => x.DeleteAsync(TestId, default)).ReturnsAsync(Result.Failure("bad", "BAD"));

        IActionResult result = await _controller.Delete(TestId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task LookupRate_Returns200_WhenFound()
    {
        ApplicableWageRateDto dto = new(TestId, Guid.NewGuid(), TestClassificationId, "CARP", 45m, 12m, 57m, new DateOnly(2026, 1, 1), null);
        _serviceMock.Setup(x => x.LookupRateAsync(It.IsAny<ApplicableWageRateLookup>(), default)).ReturnsAsync(Result.Success(dto));

        IActionResult result = await _controller.LookupRate(TestProjectId, TestClassificationId, new DateOnly(2026, 2, 1));

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task LookupRate_Returns404_WhenNotFound()
    {
        _serviceMock.Setup(x => x.LookupRateAsync(It.IsAny<ApplicableWageRateLookup>(), default))
            .ReturnsAsync(Result.Failure<ApplicableWageRateDto>("missing", "NOT_FOUND"));

        IActionResult result = await _controller.LookupRate(TestProjectId, TestClassificationId, new DateOnly(2026, 2, 1));

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    private static WageDeterminationDto CreateDto()
    {
        return new WageDeterminationDto(
            Id: TestId,
            ProjectId: TestProjectId,
            JurisdictionType: WageJurisdictionType.Federal,
            DeterminationNumber: "CA2026-001",
            SourceAgency: "DOL",
            EffectiveDate: new DateOnly(2026, 1, 1),
            ExpirationDate: null,
            Status: WageDeterminationStatus.Active,
            StatusName: "Active",
            Rates: [new WageDeterminationRateDto(Guid.NewGuid(), TestClassificationId, "CARP", "Carpenter", 45m, 12m, 57m)],
            CreatedAt: DateTime.UtcNow,
            UpdatedAt: null);
    }

    private static CreateWageDeterminationRequest CreateRequest()
    {
        return new CreateWageDeterminationRequest(
            TestProjectId,
            WageJurisdictionType.Federal,
            "CA2026-001",
            "DOL",
            new DateOnly(2026, 1, 1),
            null,
            WageDeterminationStatus.Active,
            [new WageDeterminationRateRequest(TestClassificationId, 45m, 12m, 57m)]);
    }
}
