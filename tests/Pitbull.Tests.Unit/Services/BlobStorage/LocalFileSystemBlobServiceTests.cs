using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Pitbull.Core.Services.BlobStorage;

namespace Pitbull.Tests.Unit.Services.BlobStorage;

public sealed class LocalFileSystemBlobServiceTests : IDisposable
{
    private readonly string _testBasePath;
    private readonly LocalFileSystemBlobService _service;
    private readonly Guid _tenantId = Guid.NewGuid();

    public LocalFileSystemBlobServiceTests()
    {
        _testBasePath = Path.Combine(Path.GetTempPath(), $"pitbull-blob-tests-{Guid.NewGuid():N}");
        Directory.CreateDirectory(_testBasePath);

        var options = Options.Create(new BlobStorageOptions { LocalBasePath = _testBasePath });
        _service = new LocalFileSystemBlobService(options, NullLogger<LocalFileSystemBlobService>.Instance);
    }

    public void Dispose()
    {
        if (Directory.Exists(_testBasePath))
            Directory.Delete(_testBasePath, recursive: true);
    }

    #region UploadAsync

    [Fact]
    public async Task UploadAsync_ValidFile_ReturnsBlobReference()
    {
        using var stream = CreateStream("hello world");

        var result = await _service.UploadAsync(stream, "test.txt", "text/plain", _tenantId, "photos");

        result.IsSuccess.Should().BeTrue();
        result.Value!.Key.Should().Contain(_tenantId.ToString("N"));
        result.Value.Key.Should().EndWith(".txt");
        result.Value.Size.Should().Be(11);
    }

    [Fact]
    public async Task UploadAsync_CreatesFileOnDisk()
    {
        using var stream = CreateStream("file contents");

        var result = await _service.UploadAsync(stream, "photo.jpg", "image/jpeg", _tenantId, "daily-reports");

        result.IsSuccess.Should().BeTrue();
        var fullPath = Path.Combine(_testBasePath, result.Value!.Key.Replace("/", Path.DirectorySeparatorChar.ToString()));
        File.Exists(fullPath).Should().BeTrue();
    }

    [Fact]
    public async Task UploadAsync_SanitizesContainerName()
    {
        using var stream = CreateStream("data");

        var result = await _service.UploadAsync(stream, "file.png", "image/png", _tenantId, "some/weird/../path");

        result.IsSuccess.Should().BeTrue();
        result.Value!.Key.Should().Contain("someweirdpath");
    }

    #endregion

    #region DownloadAsync

    [Fact]
    public async Task DownloadAsync_ExistingBlob_ReturnsStream()
    {
        using var stream = CreateStream("download me");
        var uploadResult = await _service.UploadAsync(stream, "doc.pdf", "application/pdf", _tenantId, "files");
        var key = uploadResult.Value!.Key;

        var result = await _service.DownloadAsync(key);

        result.IsSuccess.Should().BeTrue();
        using var reader = new StreamReader(result.Value!);
        var content = await reader.ReadToEndAsync();
        content.Should().Be("download me");
    }

    [Fact]
    public async Task DownloadAsync_NonExistentBlob_ReturnsNotFound()
    {
        var result = await _service.DownloadAsync("nonexistent/key/file.txt");

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region DeleteAsync

    [Fact]
    public async Task DeleteAsync_ExistingBlob_DeletesAndReturnsTrue()
    {
        using var stream = CreateStream("delete me");
        var uploadResult = await _service.UploadAsync(stream, "temp.txt", "text/plain", _tenantId, "temp");
        var key = uploadResult.Value!.Key;

        var result = await _service.DeleteAsync(key);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeTrue();

        var fullPath = Path.Combine(_testBasePath, key.Replace("/", Path.DirectorySeparatorChar.ToString()));
        File.Exists(fullPath).Should().BeFalse();
    }

    [Fact]
    public async Task DeleteAsync_NonExistentBlob_ReturnsFalse()
    {
        var result = await _service.DeleteAsync("nonexistent/key.txt");

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeFalse();
    }

    #endregion

    #region GetPresignedUrlAsync

    [Fact]
    public async Task GetPresignedUrlAsync_ExistingBlob_ReturnsUrl()
    {
        using var stream = CreateStream("presign me");
        var uploadResult = await _service.UploadAsync(stream, "file.jpg", "image/jpeg", _tenantId, "photos");
        var key = uploadResult.Value!.Key;

        var result = await _service.GetPresignedUrlAsync(key, TimeSpan.FromMinutes(30));

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().StartWith("local://");
        result.Value.Should().Contain(key);
    }

    [Fact]
    public async Task GetPresignedUrlAsync_NonExistentBlob_ReturnsNotFound()
    {
        var result = await _service.GetPresignedUrlAsync("missing/key.txt", TimeSpan.FromMinutes(30));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region PathTraversal

    [Fact]
    public async Task DownloadAsync_PathTraversal_ReturnsValidationError()
    {
        var result = await _service.DownloadAsync("../../etc/passwd");

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task DeleteAsync_PathTraversal_ReturnsValidationError()
    {
        var result = await _service.DeleteAsync("../../etc/passwd");

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task GetPresignedUrlAsync_PathTraversal_ReturnsValidationError()
    {
        var result = await _service.GetPresignedUrlAsync("../../etc/passwd", TimeSpan.FromMinutes(30));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    #endregion

    #region TenantIsolation

    [Fact]
    public async Task UploadAsync_DifferentTenants_StoresInSeparateDirectories()
    {
        var tenant1 = Guid.NewGuid();
        var tenant2 = Guid.NewGuid();

        using var stream1 = CreateStream("tenant1 file");
        using var stream2 = CreateStream("tenant2 file");

        var result1 = await _service.UploadAsync(stream1, "a.txt", "text/plain", tenant1, "docs");
        var result2 = await _service.UploadAsync(stream2, "b.txt", "text/plain", tenant2, "docs");

        result1.Value!.Key.Should().Contain(tenant1.ToString("N"));
        result2.Value!.Key.Should().Contain(tenant2.ToString("N"));
        result1.Value.Key.Should().NotBe(result2.Value.Key);
    }

    #endregion

    private static MemoryStream CreateStream(string content)
    {
        var stream = new MemoryStream();
        var writer = new StreamWriter(stream);
        writer.Write(content);
        writer.Flush();
        stream.Position = 0;
        return stream;
    }
}
