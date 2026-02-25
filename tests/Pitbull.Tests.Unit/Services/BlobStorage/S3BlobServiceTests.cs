using Amazon.S3;
using Amazon.S3.Model;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Pitbull.Core.Services.BlobStorage;
using Pitbull.Storage;

namespace Pitbull.Tests.Unit.Services.BlobStorage;

public sealed class S3BlobServiceTests
{
    private readonly Mock<IAmazonS3> _s3Mock = new();
    private readonly S3BlobService _service;
    private readonly Guid _tenantId = Guid.NewGuid();
    private const string TestBucket = "test-bucket";

    public S3BlobServiceTests()
    {
        var options = Options.Create(new BlobStorageOptions
        {
            Provider = "s3",
            S3Bucket = TestBucket,
        });
        _service = new S3BlobService(_s3Mock.Object, options, NullLogger<S3BlobService>.Instance);
    }

    #region UploadAsync

    [Fact]
    public async Task UploadAsync_CallsS3PutObject()
    {
        _s3Mock.Setup(s => s.PutObjectAsync(It.IsAny<PutObjectRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PutObjectResponse());

        using var stream = new MemoryStream("hello"u8.ToArray());
        var result = await _service.UploadAsync(stream, "photo.jpg", "image/jpeg", _tenantId, "photos");

        result.IsSuccess.Should().BeTrue();
        result.Value!.Key.Should().Contain(_tenantId.ToString("N"));
        result.Value.Key.Should().EndWith(".jpg");
        result.Value.Key.Should().Contain("photos");

        _s3Mock.Verify(s => s.PutObjectAsync(
            It.Is<PutObjectRequest>(r =>
                r.BucketName == TestBucket &&
                r.ContentType == "image/jpeg" &&
                r.Key.Contains(_tenantId.ToString("N"))),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UploadAsync_WhenS3Fails_ReturnsStorageError()
    {
        _s3Mock.Setup(s => s.PutObjectAsync(It.IsAny<PutObjectRequest>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new AmazonS3Exception("Access denied"));

        using var stream = new MemoryStream("data"u8.ToArray());
        var result = await _service.UploadAsync(stream, "file.txt", "text/plain", _tenantId, "files");

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("STORAGE_ERROR");
    }

    #endregion

    #region DownloadAsync

    [Fact]
    public async Task DownloadAsync_ExistingKey_ReturnsStream()
    {
        var responseStream = new MemoryStream("file content"u8.ToArray());
        _s3Mock.Setup(s => s.GetObjectAsync(TestBucket, "some/key.txt", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GetObjectResponse { ResponseStream = responseStream });

        var result = await _service.DownloadAsync("some/key.txt");

        result.IsSuccess.Should().BeTrue();
        using var reader = new StreamReader(result.Value!);
        var content = await reader.ReadToEndAsync();
        content.Should().Be("file content");
    }

    [Fact]
    public async Task DownloadAsync_NotFound_ReturnsNotFoundError()
    {
        _s3Mock.Setup(s => s.GetObjectAsync(TestBucket, "missing/key.txt", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new AmazonS3Exception("Not Found") { StatusCode = System.Net.HttpStatusCode.NotFound });

        var result = await _service.DownloadAsync("missing/key.txt");

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task DownloadAsync_S3Error_ReturnsStorageError()
    {
        _s3Mock.Setup(s => s.GetObjectAsync(TestBucket, "key.txt", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new AmazonS3Exception("Internal error") { StatusCode = System.Net.HttpStatusCode.InternalServerError });

        var result = await _service.DownloadAsync("key.txt");

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("STORAGE_ERROR");
    }

    #endregion

    #region DeleteAsync

    [Fact]
    public async Task DeleteAsync_CallsS3DeleteObject()
    {
        _s3Mock.Setup(s => s.DeleteObjectAsync(TestBucket, "key.txt", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DeleteObjectResponse());

        var result = await _service.DeleteAsync("key.txt");

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeTrue();
        _s3Mock.Verify(s => s.DeleteObjectAsync(TestBucket, "key.txt", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeleteAsync_WhenS3Fails_ReturnsStorageError()
    {
        _s3Mock.Setup(s => s.DeleteObjectAsync(TestBucket, "key.txt", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new AmazonS3Exception("Access denied"));

        var result = await _service.DeleteAsync("key.txt");

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("STORAGE_ERROR");
    }

    #endregion

    #region GetPresignedUrlAsync

    [Fact]
    public async Task GetPresignedUrlAsync_ReturnsUrl()
    {
        _s3Mock.Setup(s => s.GetPreSignedURL(It.IsAny<GetPreSignedUrlRequest>()))
            .Returns("https://test-bucket.s3.amazonaws.com/some/key.txt?X-Amz-Signature=abc");

        var result = await _service.GetPresignedUrlAsync("some/key.txt", TimeSpan.FromMinutes(60));

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Contain("test-bucket");
        result.Value.Should().Contain("key.txt");

        _s3Mock.Verify(s => s.GetPreSignedURL(
            It.Is<GetPreSignedUrlRequest>(r =>
                r.BucketName == TestBucket &&
                r.Key == "some/key.txt" &&
                r.Verb == HttpVerb.GET)), Times.Once);
    }

    [Fact]
    public async Task GetPresignedUrlAsync_WhenS3Fails_ReturnsStorageError()
    {
        _s3Mock.Setup(s => s.GetPreSignedURL(It.IsAny<GetPreSignedUrlRequest>()))
            .Throws(new AmazonS3Exception("Failed"));

        var result = await _service.GetPresignedUrlAsync("key.txt", TimeSpan.FromMinutes(60));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("STORAGE_ERROR");
    }

    #endregion

    #region TenantIsolation

    [Fact]
    public async Task UploadAsync_IncludesTenantIdInKey()
    {
        _s3Mock.Setup(s => s.PutObjectAsync(It.IsAny<PutObjectRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PutObjectResponse());

        var tenant1 = Guid.NewGuid();
        var tenant2 = Guid.NewGuid();

        using var stream1 = new MemoryStream("a"u8.ToArray());
        using var stream2 = new MemoryStream("b"u8.ToArray());

        var result1 = await _service.UploadAsync(stream1, "a.jpg", "image/jpeg", tenant1, "photos");
        var result2 = await _service.UploadAsync(stream2, "b.jpg", "image/jpeg", tenant2, "photos");

        result1.Value!.Key.Should().Contain(tenant1.ToString("N"));
        result2.Value!.Key.Should().Contain(tenant2.ToString("N"));
    }

    #endregion

    #region ConfigPropagation

    [Fact]
    public void PostConfigure_PropagatesS3BucketToOptions()
    {
        var services = new ServiceCollection();
        services.Configure<BlobStorageOptions>(_ => { }); // empty base config

        // Simulate Program.cs PostConfigure pattern
        var expectedBucket = "my-production-bucket";
        services.PostConfigure<BlobStorageOptions>(opts =>
        {
            opts.S3Bucket = expectedBucket;
            opts.S3Region = "eu-west-1";
        });

        var provider = services.BuildServiceProvider();
        var options = provider.GetRequiredService<IOptions<BlobStorageOptions>>().Value;

        options.S3Bucket.Should().Be(expectedBucket);
        options.S3Region.Should().Be("eu-west-1");
    }

    #endregion
}
