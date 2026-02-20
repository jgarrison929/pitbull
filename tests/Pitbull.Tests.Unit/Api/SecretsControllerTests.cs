using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Api.Services;

namespace Pitbull.Tests.Unit.Api;

public class SecretsControllerTests
{
    private readonly Mock<ISecretsService> _secretsServiceMock;
    private readonly SecretsController _controller;

    public SecretsControllerTests()
    {
        _secretsServiceMock = new Mock<ISecretsService>();
        _controller = new SecretsController(_secretsServiceMock.Object);
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
    }

    [Fact]
    public void GetStatus_ReturnsOkWithGroupedSecrets()
    {
        _secretsServiceMock.Setup(s => s.GetAllSecretStatuses())
            .Returns(
            [
                new SecretStatus("Jwt:Key", "JWT Key", "Authentication", true, "my-l...ough"),
                new SecretStatus("Anthropic:ApiKey", "Anthropic API Key", "AI", false, null),
                new SecretStatus("OpenAI:ApiKey", "OpenAI API Key", "AI", true, "sk-p...j3f9"),
            ]);

        var result = _controller.GetStatus();

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeOfType<SecretsStatusResponse>().Subject;

        response.ConfiguredCount.Should().Be(2);
        response.TotalCount.Should().Be(3);
        response.Categories.Should().HaveCount(2); // Authentication + AI
    }

    [Fact]
    public void GetStatus_AllConfigured_ShowsCorrectCount()
    {
        _secretsServiceMock.Setup(s => s.GetAllSecretStatuses())
            .Returns(
            [
                new SecretStatus("Jwt:Key", "JWT Key", "Auth", true, "***"),
                new SecretStatus("ConnectionStrings:PitbullDb", "DB", "Database", true, "Host=localhost;***"),
            ]);

        var result = _controller.GetStatus();

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeOfType<SecretsStatusResponse>().Subject;
        response.ConfiguredCount.Should().Be(2);
        response.TotalCount.Should().Be(2);
    }

    [Fact]
    public void GetStatus_NoneConfigured_ShowsZero()
    {
        _secretsServiceMock.Setup(s => s.GetAllSecretStatuses())
            .Returns(
            [
                new SecretStatus("Jwt:Key", "JWT Key", "Auth", false, null),
            ]);

        var result = _controller.GetStatus();

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeOfType<SecretsStatusResponse>().Subject;
        response.ConfiguredCount.Should().Be(0);
    }
}
