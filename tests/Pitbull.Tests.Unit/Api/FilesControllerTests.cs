using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Core.CQRS;
using Pitbull.Documents.Services;

namespace Pitbull.Tests.Unit.Api;

public class FilesControllerTests
{
    private readonly Mock<IFileStorageService> _fileServiceMock = new();
    private readonly Mock<IFileValidationService> _validationMock = new();
    private readonly FilesController _controller;

    public FilesControllerTests()
    {
        _controller = new FilesController(_fileServiceMock.Object, _validationMock.Object);
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
    }

    [Theory]
    [InlineData(-100, 1)]
    [InlineData(0, 1)]
    [InlineData(5000, 1440)]
    public async Task GetPresignedUrl_ClampsExpiryMinutes(int requestedMinutes, int expectedMinutes)
    {
        var fileId = Guid.NewGuid();
        TimeSpan? capturedExpiry = null;

        _fileServiceMock
            .Setup(s => s.GetPresignedUrlAsync(fileId, It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .Callback<Guid, TimeSpan, CancellationToken>((_, expiry, _) => capturedExpiry = expiry)
            .ReturnsAsync(Result.Success("https://example.com/download"));

        await _controller.GetPresignedUrl(fileId, requestedMinutes);

        capturedExpiry.Should().NotBeNull();
        capturedExpiry!.Value.TotalMinutes.Should().Be(expectedMinutes);
    }

    [Fact]
    public async Task GetPresignedUrl_NullExpiry_DefaultsTo60()
    {
        var fileId = Guid.NewGuid();
        TimeSpan? capturedExpiry = null;

        _fileServiceMock
            .Setup(s => s.GetPresignedUrlAsync(fileId, It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .Callback<Guid, TimeSpan, CancellationToken>((_, expiry, _) => capturedExpiry = expiry)
            .ReturnsAsync(Result.Success("https://example.com/download"));

        await _controller.GetPresignedUrl(fileId, expiresInMinutes: null);

        capturedExpiry!.Value.TotalMinutes.Should().Be(60);
    }
}
