using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Billing.Features.PayrollReviews;
using Pitbull.Billing.Services;
using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;

namespace Pitbull.Tests.Unit.Api;

public class PayrollReviewsControllerTests
{
    private readonly Mock<IPayrollReviewService> _serviceMock;
    private readonly PayrollReviewsController _controller;

    private static readonly Guid TestReviewId = Guid.NewGuid();
    private static readonly Guid TestRunId = Guid.NewGuid();

    public PayrollReviewsControllerTests()
    {
        _serviceMock = new Mock<IPayrollReviewService>();
        _controller = new PayrollReviewsController(_serviceMock.Object)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
    }

    [Fact]
    public async Task List_Returns200_WhenSuccessful()
    {
        _serviceMock.Setup(x => x.ListAsync(It.IsAny<ListPayrollRunReviewsQuery>(), default))
            .ReturnsAsync(Result.Success(new ListPayrollRunReviewsResult([CreateDto()], 1, 1, 25, 1)));

        IActionResult result = await _controller.List(PayrollReviewStatus.Pending, TestRunId, true, 1, 25);

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task List_Returns400_WhenServiceFails()
    {
        _serviceMock.Setup(x => x.ListAsync(It.IsAny<ListPayrollRunReviewsQuery>(), default))
            .ReturnsAsync(Result.Failure<ListPayrollRunReviewsResult>("bad", "BAD"));

        IActionResult result = await _controller.List(null, null, false, 1, 25);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task List_PassesPendingOnlyToService()
    {
        _serviceMock.Setup(x => x.ListAsync(It.IsAny<ListPayrollRunReviewsQuery>(), default))
            .ReturnsAsync(Result.Success(new ListPayrollRunReviewsResult([], 0, 1, 25, 0)));

        await _controller.List(null, TestRunId, true, 2, 10);

        _serviceMock.Verify(x => x.ListAsync(
            It.Is<ListPayrollRunReviewsQuery>(q => q.PendingOnly && q.PayrollRunId == TestRunId && q.Page == 2 && q.PageSize == 10),
            default), Times.Once);
    }

    [Fact]
    public async Task GetById_Returns200_WhenFound()
    {
        _serviceMock.Setup(x => x.GetAsync(TestReviewId, default)).ReturnsAsync(Result.Success(CreateDto()));

        IActionResult result = await _controller.GetById(TestReviewId);

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task GetById_Returns404_WhenNotFound()
    {
        _serviceMock.Setup(x => x.GetAsync(TestReviewId, default)).ReturnsAsync(Result.Failure<PayrollRunReviewDto>("missing", "NOT_FOUND"));

        IActionResult result = await _controller.GetById(TestReviewId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetById_Returns400_WhenFailure()
    {
        _serviceMock.Setup(x => x.GetAsync(TestReviewId, default)).ReturnsAsync(Result.Failure<PayrollRunReviewDto>("bad", "BAD"));

        IActionResult result = await _controller.GetById(TestReviewId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Submit_Returns200_WhenSuccessful()
    {
        _serviceMock.Setup(x => x.SubmitAsync(It.IsAny<SubmitPayrollRunForReviewCommand>(), default)).ReturnsAsync(Result.Success(CreateDto()));

        IActionResult result = await _controller.Submit(new SubmitPayrollReviewRequest(TestRunId, "pm-1", "ready"));

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task Submit_Returns404_WhenRunMissing()
    {
        _serviceMock.Setup(x => x.SubmitAsync(It.IsAny<SubmitPayrollRunForReviewCommand>(), default))
            .ReturnsAsync(Result.Failure<PayrollRunReviewDto>("missing", "NOT_FOUND"));

        IActionResult result = await _controller.Submit(new SubmitPayrollReviewRequest(TestRunId, "pm-1", "ready"));

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Submit_Returns400_WhenFailure()
    {
        _serviceMock.Setup(x => x.SubmitAsync(It.IsAny<SubmitPayrollRunForReviewCommand>(), default))
            .ReturnsAsync(Result.Failure<PayrollRunReviewDto>("bad", "BAD"));

        IActionResult result = await _controller.Submit(new SubmitPayrollReviewRequest(TestRunId, "pm-1", "ready"));

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Approve_Returns200_WhenSuccessful()
    {
        _serviceMock.Setup(x => x.ApproveAsync(It.IsAny<ApprovePayrollRunReviewCommand>(), default)).ReturnsAsync(Result.Success(CreateDto(PayrollReviewStatus.Approved)));

        IActionResult result = await _controller.Approve(TestReviewId, new PayrollReviewDecisionRequest("pm-1", "approved"));

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task Approve_Returns404_WhenMissing()
    {
        _serviceMock.Setup(x => x.ApproveAsync(It.IsAny<ApprovePayrollRunReviewCommand>(), default))
            .ReturnsAsync(Result.Failure<PayrollRunReviewDto>("missing", "NOT_FOUND"));

        IActionResult result = await _controller.Approve(TestReviewId, new PayrollReviewDecisionRequest("pm-1", "approved"));

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Reject_Returns200_WhenSuccessful()
    {
        _serviceMock.Setup(x => x.RejectAsync(It.IsAny<RejectPayrollRunReviewCommand>(), default)).ReturnsAsync(Result.Success(CreateDto(PayrollReviewStatus.Rejected)));

        IActionResult result = await _controller.Reject(TestReviewId, new PayrollReviewDecisionRequest("pm-1", "fix this"));

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task Reject_Returns404_WhenMissing()
    {
        _serviceMock.Setup(x => x.RejectAsync(It.IsAny<RejectPayrollRunReviewCommand>(), default))
            .ReturnsAsync(Result.Failure<PayrollRunReviewDto>("missing", "NOT_FOUND"));

        IActionResult result = await _controller.Reject(TestReviewId, new PayrollReviewDecisionRequest("pm-1", "fix this"));

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Escalate_Returns200_WhenSuccessful()
    {
        _serviceMock.Setup(x => x.EscalateAsync(It.IsAny<EscalatePayrollRunReviewCommand>(), default)).ReturnsAsync(Result.Success(CreateDto(PayrollReviewStatus.Escalated)));

        IActionResult result = await _controller.Escalate(TestReviewId, new PayrollReviewDecisionRequest("pm-1", "needs audit"));

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task Escalate_Returns400_WhenServiceFails()
    {
        _serviceMock.Setup(x => x.EscalateAsync(It.IsAny<EscalatePayrollRunReviewCommand>(), default))
            .ReturnsAsync(Result.Failure<PayrollRunReviewDto>("invalid", "INVALID_STATUS"));

        IActionResult result = await _controller.Escalate(TestReviewId, new PayrollReviewDecisionRequest("pm-1", "needs audit"));

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Approve_PassesCommandValues()
    {
        _serviceMock.Setup(x => x.ApproveAsync(It.IsAny<ApprovePayrollRunReviewCommand>(), default)).ReturnsAsync(Result.Success(CreateDto(PayrollReviewStatus.Approved)));

        await _controller.Approve(TestReviewId, new PayrollReviewDecisionRequest("pm-2", "ship it"));

        _serviceMock.Verify(x => x.ApproveAsync(
            It.Is<ApprovePayrollRunReviewCommand>(c => c.ReviewId == TestReviewId && c.ReviewerUserId == "pm-2" && c.Comments == "ship it"),
            default), Times.Once);
    }

    private static PayrollRunReviewDto CreateDto(PayrollReviewStatus status = PayrollReviewStatus.Submitted)
    {
        return new PayrollRunReviewDto(
            Id: TestReviewId,
            PayrollRunId: TestRunId,
            ReviewerUserId: "pm-1",
            Status: status,
            StatusName: status.ToString(),
            Comments: null,
            SubmittedAt: DateTime.UtcNow,
            ReviewedAt: null,
            EscalatedAt: null,
            CreatedAt: DateTime.UtcNow,
            UpdatedAt: null);
    }
}
