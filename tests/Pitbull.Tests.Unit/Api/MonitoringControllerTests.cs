using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Moq;
using Pitbull.Api.Controllers;

namespace Pitbull.Tests.Unit.Api;

public class MonitoringControllerTests
{
    private static Mock<HealthCheckService> CreateHealthCheckMock(HealthStatus status = HealthStatus.Healthy)
    {
        var entries = new Dictionary<string, HealthReportEntry>
        {
            ["self"] = new HealthReportEntry(
                status,
                status == HealthStatus.Healthy ? "OK" : "Unhealthy",
                TimeSpan.FromMilliseconds(10),
                status == HealthStatus.Healthy ? null : new Exception("Health check failed"),
                null,
                ["live"])
        };

        var report = new HealthReport(entries, TimeSpan.FromMilliseconds(50));

        var mock = new Mock<HealthCheckService>();
        mock.Setup(h => h.CheckHealthAsync(
                It.IsAny<Func<HealthCheckRegistration, bool>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(report);

        return mock;
    }

    private static MonitoringController CreateController(Mock<HealthCheckService> healthMock, bool authenticated = false)
    {
        var services = new ServiceCollection();
        var serviceProvider = services.BuildServiceProvider();

        var httpContext = new DefaultHttpContext
        {
            RequestServices = serviceProvider
        };

        if (authenticated)
        {
            var claims = new[] { new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()) };
            var identity = new ClaimsIdentity(claims, "TestAuth");
            httpContext.User = new ClaimsPrincipal(identity);
        }

        var controller = new MonitoringController(healthMock.Object);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = httpContext
        };
        return controller;
    }

    [Fact]
    public void GetVersion_ReturnsVersionInfo()
    {
        var healthMock = CreateHealthCheckMock();
        var controller = CreateController(healthMock);

        var result = controller.GetVersion();

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var version = okResult.Value.Should().BeOfType<VersionInfo>().Subject;
        version.Version.Should().NotBeNullOrEmpty();
        version.FrameworkVersion.Should().NotBeNullOrEmpty();
        version.MachineName.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task GetHealth_Healthy_Returns200()
    {
        var healthMock = CreateHealthCheckMock(HealthStatus.Healthy);
        var controller = CreateController(healthMock);

        var result = await controller.GetHealth();

        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(200);
        var response = objectResult.Value.Should().BeOfType<HealthResponse>().Subject;
        response.Status.Should().Be("Healthy");
        response.Entries.Should().ContainKey("self");
        response.Entries["self"].Status.Should().Be("Healthy");
    }

    [Fact]
    public async Task GetHealth_Unhealthy_Returns503()
    {
        var healthMock = CreateHealthCheckMock(HealthStatus.Unhealthy);
        var controller = CreateController(healthMock);

        var result = await controller.GetHealth();

        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(503);
        var response = objectResult.Value.Should().BeOfType<HealthResponse>().Subject;
        response.Status.Should().Be("Unhealthy");
    }

    [Fact]
    public async Task GetHealth_Degraded_Returns503()
    {
        var healthMock = CreateHealthCheckMock(HealthStatus.Degraded);
        var controller = CreateController(healthMock);

        var result = await controller.GetHealth();

        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(503);
        var response = objectResult.Value.Should().BeOfType<HealthResponse>().Subject;
        response.Status.Should().Be("Degraded");
    }

    [Fact]
    public void GetSecurity_ReturnsSecurityStatus()
    {
        var healthMock = CreateHealthCheckMock();
        var controller = CreateController(healthMock, authenticated: true);

        var result = controller.GetSecurity();

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var security = okResult.Value.Should().BeOfType<SecurityStatus>().Subject;
        security.SecurityHeadersEnabled.Should().BeTrue();
        security.RequestSizeLimitsEnabled.Should().BeTrue();
        security.AuthenticationEnabled.Should().BeTrue();
    }

    [Fact]
    public void GetSecurity_Unauthenticated_ShowsNotAuthenticated()
    {
        var healthMock = CreateHealthCheckMock();
        var controller = CreateController(healthMock, authenticated: false);

        var result = controller.GetSecurity();

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var security = okResult.Value.Should().BeOfType<SecurityStatus>().Subject;
        security.AuthenticationEnabled.Should().BeFalse();
    }
}
