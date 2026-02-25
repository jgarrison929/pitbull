using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Pitbull.Core.CQRS;
using Pitbull.Core.Services.BlobStorage;

namespace Pitbull.Storage;

public class S3BlobService : IBlobStorageService
{
    private readonly IAmazonS3 _s3Client;
    private readonly BlobStorageOptions _options;
    private readonly ILogger<S3BlobService> _logger;

    public S3BlobService(IAmazonS3 s3Client, IOptions<BlobStorageOptions> options, ILogger<S3BlobService> logger)
    {
        _s3Client = s3Client;
        _options = options.Value;
        _logger = logger;
    }

    private string BucketName => _options.S3Bucket ?? throw new InvalidOperationException("S3_BUCKET is not configured");

    public async Task<Result<BlobReference>> UploadAsync(
        Stream content, string fileName, string contentType, Guid tenantId,
        string containerName, CancellationToken ct = default)
    {
        try
        {
            var ext = Path.GetExtension(fileName);
            var key = $"{tenantId:N}/{SanitizeName(containerName)}/{Guid.NewGuid():N}{ext}";

            var request = new PutObjectRequest
            {
                BucketName = BucketName,
                Key = key,
                InputStream = content,
                ContentType = contentType,
                AutoCloseStream = false,
            };

            await _s3Client.PutObjectAsync(request, ct);

            var size = content.CanSeek ? content.Length : 0;
            var url = $"s3://{BucketName}/{key}";

            return Result.Success(new BlobReference(key, url, size));
        }
        catch (AmazonS3Exception ex)
        {
            _logger.LogError(ex, "S3 upload failed for bucket {Bucket}", BucketName);
            return Result.Failure<BlobReference>("Failed to store file in S3", "STORAGE_ERROR");
        }
    }

    public async Task<Result<Stream>> DownloadAsync(string blobKey, CancellationToken ct = default)
    {
        try
        {
            var response = await _s3Client.GetObjectAsync(BucketName, blobKey, ct);
            // ResponseStream disposes the parent GetObjectResponse when closed.
            // Caller owns the stream and must dispose it.
            return Result.Success<Stream>(response.ResponseStream);
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return Result.Failure<Stream>("Blob not found", "NOT_FOUND");
        }
        catch (AmazonS3Exception ex)
        {
            _logger.LogError(ex, "S3 download failed for key {Key}", blobKey);
            return Result.Failure<Stream>("Failed to download file from S3", "STORAGE_ERROR");
        }
    }

    public async Task<Result<bool>> DeleteAsync(string blobKey, CancellationToken ct = default)
    {
        try
        {
            await _s3Client.DeleteObjectAsync(BucketName, blobKey, ct);
            return Result.Success(true);
        }
        catch (AmazonS3Exception ex)
        {
            _logger.LogError(ex, "S3 delete failed for key {Key}", blobKey);
            return Result.Failure<bool>("Failed to delete file from S3", "STORAGE_ERROR");
        }
    }

    public Task<Result<string>> GetPresignedUrlAsync(string blobKey, TimeSpan expiresIn, CancellationToken ct = default)
    {
        try
        {
            var request = new GetPreSignedUrlRequest
            {
                BucketName = BucketName,
                Key = blobKey,
                Expires = DateTime.UtcNow.Add(expiresIn),
                Verb = HttpVerb.GET,
            };

            var url = _s3Client.GetPreSignedURL(request);
            return Task.FromResult(Result.Success(url));
        }
        catch (AmazonS3Exception ex)
        {
            _logger.LogError(ex, "Failed to generate presigned URL for key {Key}", blobKey);
            return Task.FromResult(Result.Failure<string>("Failed to generate download URL", "STORAGE_ERROR"));
        }
    }

    private static string SanitizeName(string name)
    {
        return System.Text.RegularExpressions.Regex.Replace(name, @"[^a-zA-Z0-9_\-]", "");
    }
}
