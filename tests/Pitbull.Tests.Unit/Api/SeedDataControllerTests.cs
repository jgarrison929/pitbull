using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.FileProviders;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Api.Features.SeedData;
using Pitbull.Core.CQRS;

namespace Pitbull.Tests.Unit.Api;

public class SeedDataControllerTests
{
    private readonly Mock<ISeedDataService> _seedServiceMock;
    private readonly Mock<IWebHostEnvironment> _envMock;

    public SeedDataControllerTests()
    {
        _seedServiceMock = new Mock<ISeedDataService>();
        _envMock = new Mock<IWebHostEnvironment>();
    }

    private SeedDataController CreateController(string environmentName = "Development")
    {
        _envMock.Setup(e => e.EnvironmentName).Returns(environmentName);
        // IWebHostEnvironment also needs ContentRootPath and other props, but IsDevelopment()
        // is an extension method that checks EnvironmentName == "Development"
        // We also need to supply ApplicationName for the extension method
        _envMock.Setup(e => e.ApplicationName).Returns("Pitbull.Api");
        _envMock.Setup(e => e.ContentRootPath).Returns("/app");
        _envMock.Setup(e => e.WebRootPath).Returns("/app/wwwroot");
        _envMock.Setup(e => e.ContentRootFileProvider).Returns(Mock.Of<IFileProvider>());
        _envMock.Setup(e => e.WebRootFileProvider).Returns(Mock.Of<IFileProvider>());

        var controller = new SeedDataController(_seedServiceMock.Object, _envMock.Object);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
        return controller;
    }

    [Fact]
    public async Task Seed_InDevelopment_ReturnsOk()
    {
        var controller = CreateController("Development");
        var seedResult = new SeedDataResult(5, 10, 50, 15, 20, 8, 12, 30, 3, 2, 1, Summary: "Seeded!");
        _seedServiceMock.Setup(s => s.SeedAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success(seedResult));

        var result = await controller.Seed();

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<SeedDataResult>().Subject;
        response.ProjectsCreated.Should().Be(5);
        response.Summary.Should().Be("Seeded!");
    }

    [Fact]
    public async Task Seed_InProduction_Returns404()
    {
        var controller = CreateController("Production");

        var result = await controller.Seed();

        result.Should().BeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task Seed_InStaging_Returns404()
    {
        var controller = CreateController("Staging");

        var result = await controller.Seed();

        result.Should().BeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task Seed_AlreadyExists_Returns409()
    {
        var controller = CreateController("Development");
        _seedServiceMock.Setup(s => s.SeedAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure<SeedDataResult>("Data already exists", "ALREADY_EXISTS"));

        var result = await controller.Seed();

        var conflictResult = result.Should().BeOfType<ConflictObjectResult>().Subject;
        conflictResult.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task Seed_OtherFailure_Returns400()
    {
        var controller = CreateController("Development");
        _seedServiceMock.Setup(s => s.SeedAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure<SeedDataResult>("Something broke", "UNKNOWN_ERROR"));

        var result = await controller.Seed();

        var badRequestResult = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequestResult.StatusCode.Should().Be(400);
    }
}
