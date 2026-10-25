using Pitbull.Core.CQRS;

namespace Pitbull.Core.Services.BlobStorage;

public record BlobReference(string Key, string? Url, long Size);

public interface IBlobStorageService
{
    Task<Result<BlobReference>> UploadAsync(
        Stream content,
        string fileName,
        string contentType,
        Guid tenantId,
        string containerName,
        CancellationToken ct = default);

    Task<Result<Stream>> DownloadAsync(string blobKey, CancellationToken ct = default);

    Task<Result<bool>> DeleteAsync(string blobKey, CancellationToken ct = default);

    Task<Result<string>> GetPresignedUrlAsync(string blobKey, TimeSpan expiresIn, CancellationToken ct = default);
}
