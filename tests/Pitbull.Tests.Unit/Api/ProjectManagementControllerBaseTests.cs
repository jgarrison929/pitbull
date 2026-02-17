using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Pitbull.Api.Controllers;
using Pitbull.Core.CQRS;

namespace Pitbull.Tests.Unit.Api;

public class ProjectManagementControllerBaseTests
{
    private readonly TestableController _controller;

    public ProjectManagementControllerBaseTests()
    {
        _controller = new TestableController
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };
    }

    #region HandleResult<T>

    [Fact]
    public void HandleResult_Success_Returns200()
    {
        var result = Result.Success("ok");
        var response = _controller.TestHandleResult(result);
        var ok = response.Should().BeOfType<OkObjectResult>().Subject;
        ok.StatusCode.Should().Be(200);
    }

    [Fact]
    public void HandleResult_NotFound_Returns404()
    {
        var result = Result.Failure<string>("Not found", "NOT_FOUND");
        var response = _controller.TestHandleResult(result);
        var notFound = response.Should().BeOfType<NotFoundObjectResult>().Subject;
        notFound.StatusCode.Should().Be(404);
    }

    [Fact]
    public void HandleResult_Unauthorized_Returns401()
    {
        var result = Result.Failure<string>("Not authorized to access this project", "UNAUTHORIZED");
        var response = _controller.TestHandleResult(result);
        var unauthorized = response.Should().BeOfType<UnauthorizedObjectResult>().Subject;
        unauthorized.StatusCode.Should().Be(401);
    }

    [Fact]
    public void HandleResult_Forbidden_Returns403()
    {
        var result = Result.Failure<string>("Access denied", "FORBIDDEN");
        var response = _controller.TestHandleResult(result);
        var forbidden = response.Should().BeOfType<ObjectResult>().Subject;
        forbidden.StatusCode.Should().Be(403);
    }

    [Fact]
    public void HandleResult_ValidationError_Returns400()
    {
        var result = Result.Failure<string>("Invalid input", "VALIDATION_ERROR");
        var response = _controller.TestHandleResult(result);
        var badRequest = response.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequest.StatusCode.Should().Be(400);
    }

    #endregion

    #region HandleAction

    [Fact]
    public void HandleAction_Success_Returns204()
    {
        var result = Result.Success();
        var response = _controller.TestHandleAction(result);
        response.Should().BeOfType<NoContentResult>();
    }

    [Fact]
    public void HandleAction_NotFound_Returns404()
    {
        var result = Result.Failure("Not found", "NOT_FOUND");
        var response = _controller.TestHandleAction(result);
        var notFound = response.Should().BeOfType<NotFoundObjectResult>().Subject;
        notFound.StatusCode.Should().Be(404);
    }

    [Fact]
    public void HandleAction_Unauthorized_Returns401()
    {
        var result = Result.Failure("Not authorized", "UNAUTHORIZED");
        var response = _controller.TestHandleAction(result);
        var unauthorized = response.Should().BeOfType<UnauthorizedObjectResult>().Subject;
        unauthorized.StatusCode.Should().Be(401);
    }

    [Fact]
    public void HandleAction_Forbidden_Returns403()
    {
        var result = Result.Failure("Access denied", "FORBIDDEN");
        var response = _controller.TestHandleAction(result);
        var forbidden = response.Should().BeOfType<ObjectResult>().Subject;
        forbidden.StatusCode.Should().Be(403);
    }

    #endregion

    /// <summary>
    /// Concrete subclass to expose protected methods for testing.
    /// </summary>
    private class TestableController : ProjectManagementControllerBase
    {
        public IActionResult TestHandleResult<T>(Result<T> result) => HandleResult(result);
        public IActionResult TestHandleAction(Result result) => HandleAction(result);
    }
}
