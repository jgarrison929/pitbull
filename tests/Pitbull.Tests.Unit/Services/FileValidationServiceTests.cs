using FluentAssertions;
using Pitbull.Documents.Services;

namespace Pitbull.Tests.Unit.Services;

public class FileValidationServiceTests
{
    private readonly FileValidationService _sut = new();

    #region Blocked Extensions

    [Theory]
    [InlineData("malware.exe")]
    [InlineData("script.bat")]
    [InlineData("script.cmd")]
    [InlineData("script.ps1")]
    [InlineData("library.dll")]
    [InlineData("program.com")]
    [InlineData("screensaver.scr")]
    [InlineData("installer.msi")]
    [InlineData("script.vbs")]
    [InlineData("script.js")]
    [InlineData("script.wsf")]
    [InlineData("app.hta")]
    [InlineData("panel.cpl")]
    [InlineData("setup.inf")]
    [InlineData("registry.reg")]
    [InlineData("shortcut.pif")]
    [InlineData("script.sh")]
    [InlineData("script.bash")]
    public void ValidateFile_BlockedExtension_ReturnsFailure(string fileName)
    {
        var result = _sut.ValidateFile(fileName, "application/octet-stream", 1024);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_FILE");
        result.Error.Should().Contain("not allowed");
    }

    [Fact]
    public void ValidateFile_BlockedExtension_CaseInsensitive_ReturnsFailure()
    {
        var result = _sut.ValidateFile("FILE.EXE", "application/octet-stream", 1024);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_FILE");
    }

    [Fact]
    public void ValidateFile_BlockedExtension_MixedCase_ReturnsFailure()
    {
        var result = _sut.ValidateFile("virus.ExE", "application/octet-stream", 1024);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_FILE");
    }

    #endregion

    #region Double Extension

    [Fact]
    public void ValidateFile_DoubleExtension_BlockedSecond_ReturnsFailure()
    {
        var result = _sut.ValidateFile("report.pdf.exe", "application/pdf", 1024);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_FILE");
        result.Error.Should().Contain(".exe");
    }

    [Fact]
    public void ValidateFile_DoubleExtension_BlockedFirst_ReturnsFailure()
    {
        var result = _sut.ValidateFile("malware.exe.pdf", "application/pdf", 1024);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_FILE");
        result.Error.Should().Contain(".exe");
    }

    [Fact]
    public void ValidateFile_TripleExtension_WithBlocked_ReturnsFailure()
    {
        var result = _sut.ValidateFile("file.doc.pdf.bat", "application/pdf", 1024);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_FILE");
    }

    #endregion

    #region Allowed Files

    [Theory]
    [InlineData("photo.png", "image/png")]
    [InlineData("photo.jpg", "image/jpeg")]
    [InlineData("document.pdf", "application/pdf")]
    [InlineData("spreadsheet.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")]
    [InlineData("document.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")]
    [InlineData("presentation.pptx", "application/vnd.ms-powerpoint")]
    [InlineData("legacy.doc", "application/msword")]
    [InlineData("legacy.xls", "application/vnd.ms-excel")]
    [InlineData("notes.txt", "text/plain")]
    [InlineData("data.csv", "text/csv")]
    [InlineData("video.mp4", "video/mp4")]
    [InlineData("audio.mp3", "audio/mpeg")]
    [InlineData("archive.zip", "application/zip")]
    public void ValidateFile_AllowedFile_ReturnsSuccess(string fileName, string contentType)
    {
        var result = _sut.ValidateFile(fileName, contentType, 1024);

        result.IsSuccess.Should().BeTrue();
    }

    #endregion

    #region Content Type Validation

    [Fact]
    public void ValidateFile_UnknownContentType_ReturnsFailure()
    {
        var result = _sut.ValidateFile("file.xyz", "application/x-something-weird", 1024);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_FILE");
        result.Error.Should().Contain("Content type");
    }

    [Fact]
    public void ValidateFile_EmptyContentType_ReturnsFailure()
    {
        var result = _sut.ValidateFile("file.txt", "", 1024);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_FILE");
    }

    [Fact]
    public void ValidateFile_OctetStream_SafeExtension_ReturnsSuccess()
    {
        var result = _sut.ValidateFile("drawing.dwg", "application/octet-stream", 1024);

        result.IsSuccess.Should().BeTrue();
    }

    [Theory]
    [InlineData("drawing.dwg")]
    [InlineData("model.rvt")]
    [InlineData("building.ifc")]
    [InlineData("design.dwf")]
    public void ValidateFile_OctetStream_AllSafeExtensions_ReturnsSuccess(string fileName)
    {
        var result = _sut.ValidateFile(fileName, "application/octet-stream", 1024);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public void ValidateFile_OctetStream_UnsafeExtension_ReturnsFailure()
    {
        var result = _sut.ValidateFile("file.xyz", "application/octet-stream", 1024);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_FILE");
        result.Error.Should().Contain("application/octet-stream");
    }

    #endregion

    #region File Size Validation

    [Fact]
    public void ValidateFile_ExceedsMaxSize_ReturnsFailure()
    {
        long oversized = 51L * 1024 * 1024; // 51 MB
        var result = _sut.ValidateFile("photo.png", "image/png", oversized);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_FILE");
        result.Error.Should().Contain("50MB");
    }

    [Fact]
    public void ValidateFile_ExactlyMaxSize_ReturnsSuccess()
    {
        long exactMax = 50L * 1024 * 1024; // 50 MB
        var result = _sut.ValidateFile("photo.png", "image/png", exactMax);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public void ValidateFile_ZeroSize_ReturnsFailure()
    {
        var result = _sut.ValidateFile("photo.png", "image/png", 0);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_FILE");
        result.Error.Should().Contain("empty");
    }

    [Fact]
    public void ValidateFile_NegativeSize_ReturnsFailure()
    {
        var result = _sut.ValidateFile("photo.png", "image/png", -1);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_FILE");
    }

    #endregion

    #region Edge Cases

    [Fact]
    public void ValidateFile_EmptyFileName_ReturnsFailure()
    {
        var result = _sut.ValidateFile("", "image/png", 1024);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_FILE");
    }

    [Fact]
    public void ValidateFile_NoExtension_ReturnsFailure()
    {
        var result = _sut.ValidateFile("README", "text/plain", 1024);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_FILE");
        result.Error.Should().Contain("extension");
    }

    [Fact]
    public void ValidateFile_SafeDoubleExtension_ReturnsSuccess()
    {
        // Two safe extensions should be fine
        var result = _sut.ValidateFile("archive.backup.zip", "application/zip", 1024);

        result.IsSuccess.Should().BeTrue();
    }

    #endregion
}
