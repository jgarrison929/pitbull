using FluentAssertions;
using Pitbull.Api.Extensions;
using Pitbull.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace Pitbull.Tests.Unit.Api;

public class ErrorResponseTests
{
    [Fact]
    public void ErrorResponseBuilder_Create_ShouldReturnCorrectFormat()
    {
        // Act
        var result = ErrorResponseBuilder.Create("Test message", "TEST_CODE", "trace-123");

        // Assert
        result.Should().NotBeNull();
        result.Error.Message.Should().Be("Test message");
        result.Error.Code.Should().Be("TEST_CODE");
        result.TraceId.Should().Be("trace-123");
        result.Timestamp.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public void ErrorResponseBuilder_CreateValidation_ShouldIncludeDetails()
    {
        // Arrange
        var details = new Dictionary<string, string[]>
        {
            ["Email"] = new[] { "Email is required" },
            ["Password"] = new[] { "Password too weak", "Password must be 8+ chars" }
        };

        // Act
        var result = ErrorResponseBuilder.CreateValidation("Validation failed", details, "trace-456");

        // Assert
        result.Error.Message.Should().Be("Validation failed");
        result.Error.Code.Should().Be("VALIDATION_FAILED");
        result.Error.Details.Should().BeEquivalentTo(details);
        result.TraceId.Should().Be("trace-456");
    }

    [Fact]
    public void ErrorResponseBuilder_Common_NotFound_ShouldHaveCorrectDefaults()
    {
        // Act
        var result = ErrorResponseBuilder.Common.NotFound();

        // Assert
        result.Error.Message.Should().Be("Resource not found");
        result.Error.Code.Should().Be("NOT_FOUND");
    }

    [Fact]
    public void ControllerExtensions_NotFoundError_ShouldReturnStandardFormat()
    {
        // Arrange
        var controller = new TestController();

        // Act
        var result = controller.NotFoundError("Custom not found message");

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
        var errorResponse = result.Value.Should().BeOfType<ErrorResponse>().Subject;
        errorResponse.Error.Message.Should().Be("Custom not found message");
        errorResponse.Error.Code.Should().Be("NOT_FOUND");
    }

    [Fact]
    public void ControllerExtensions_ValidationError_FromFluentValidation_ShouldFormatCorrectly()
    {
        // Arrange
        var controller = new TestController();
        var validationResult = new FluentValidation.Results.ValidationResult();
        validationResult.Errors.Add(new FluentValidation.Results.ValidationFailure("Email", "Email is required"));
        validationResult.Errors.Add(new FluentValidation.Results.ValidationFailure("Password", "Password too weak"));

        // Act
        var result = controller.ValidationError(validationResult);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
        var errorResponse = result.Value.Should().BeOfType<ErrorResponse>().Subject;
        errorResponse.Error.Code.Should().Be("VALIDATION_FAILED");
        errorResponse.Error.Details.Should().ContainKey("Email");
        errorResponse.Error.Details.Should().ContainKey("Password");
        errorResponse.Error.Details["Email"].Should().Equal("Email is required");
        errorResponse.Error.Details["Password"].Should().Equal("Password too weak");
    }

    private class TestController : ControllerBase
    {
        public TestController()
        {
            // Mock HttpContext for TraceIdentifier
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            };
            ControllerContext.HttpContext.TraceIdentifier = "test-trace-id";
        }
    }
}