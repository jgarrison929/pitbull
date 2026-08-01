using FluentAssertions;
using Pitbull.Documents.Services;

namespace Pitbull.Tests.Unit.Services;

public class FileValidationServiceTests
{
    private readonly FileValidationService _svc = new();

    [Fact]
    public void ValidateFile_AllowsPdf()
    {
        var result = _svc.ValidateFile("report.pdf", "application/pdf", 1024);
        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public void ValidateFile_RejectsSvgExtension()
    {
        var result = _svc.ValidateFile("logo.svg", "image/svg+xml", 1024);
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_FILE");
    }

    [Fact]
    public void ValidateFile_RejectsSvgContentType()
    {
        var result = _svc.ValidateFile("logo.png", "image/svg+xml", 1024);
        result.IsSuccess.Should().BeFalse();
    }

    [Fact]
    public void ValidateFile_RejectsHtml()
    {
        var result = _svc.ValidateFile("page.html", "text/html", 1024);
        result.IsSuccess.Should().BeFalse();
    }

    [Fact]
    public void ValidateFile_RejectsPathTraversalName()
    {
        var result = _svc.ValidateFile("../secret.pdf", "application/pdf", 1024);
        result.IsSuccess.Should().BeFalse();
    }

    [Fact]
    public void ValidateFile_RejectsDoubleExtensionExe()
    {
        var result = _svc.ValidateFile("report.pdf.exe", "application/pdf", 1024);
        result.IsSuccess.Should().BeFalse();
    }

    [Fact]
    public void ValidateFile_RejectsOversized()
    {
        var result = _svc.ValidateFile("big.pdf", "application/pdf", 60L * 1024 * 1024);
        result.IsSuccess.Should().BeFalse();
    }
}
