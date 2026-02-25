using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Pitbull.Core.CQRS;

namespace Pitbull.Core.Services.BlobStorage;

public class LocalFileSystemBlobService : IBlobStorageService
{
    private readonly BlobStorageOptions _options;
    private readonly ILogger<LocalFileSystemBlobService> _logger;

    public LocalFileSystemBlobService(IOptions<BlobStorageOptions> options, ILogger<LocalFileSystemBlobService> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task<Result<BlobReference>> UploadAsync(
        Stream content, string fileName, string contentType, Guid tenantId,
        string containerName, CancellationToken ct = default)
    {
        try
        {
            var ext = Path.GetExtension(fileName);
            var blobKey = $"{tenantId:N}/{SanitizeName(containerName)}/{Guid.NewGuid():N}{ext}";

            var fullPath = GetFullPath(blobKey);
            if (!IsInsideBasePath(fullPath))
                return Result.Failure<BlobReference>("Invalid storage path", "VALIDATION_ERROR");

            Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);

            await using var fileStream = new FileStream(fullPath, FileMode.Create, FileAccess.Write);
            await content.CopyToAsync(fileStream, ct);
            var size = fileStream.Length;

            return Result.Success(new BlobReference(blobKey, null, size));
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            _logger.LogError(ex, "Failed to write blob to local filesystem");
            return Result.Failure<BlobReference>("Failed to store file", "STORAGE_ERROR");
        }
    }

    public Task<Result<Stream>> DownloadAsync(string blobKey, CancellationToken ct = default)
    {
        var fullPath = GetFullPath(blobKey);

        if (!IsInsideBasePath(fullPath))
            return Task.FromResult(Result.Failure<Stream>("Invalid storage path", "VALIDATION_ERROR"));

        if (!File.Exists(fullPath))
            return Task.FromResult(Result.Failure<Stream>("Blob not found", "NOT_FOUND"));

        Stream stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        return Task.FromResult(Result.Success(stream));
    }

    public Task<Result<bool>> DeleteAsync(string blobKey, CancellationToken ct = default)
    {
        var fullPath = GetFullPath(blobKey);

        if (!IsInsideBasePath(fullPath))
            return Task.FromResult(Result.Failure<bool>("Invalid storage path", "VALIDATION_ERROR"));

        if (!File.Exists(fullPath))
            return Task.FromResult(Result.Success(false));

        try
        {
            File.Delete(fullPath);
            return Task.FromResult(Result.Success(true));
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            _logger.LogError(ex, "Failed to delete blob {BlobKey}", blobKey);
            return Task.FromResult(Result.Failure<bool>("Failed to delete file", "STORAGE_ERROR"));
        }
    }

    public Task<Result<string>> GetPresignedUrlAsync(string blobKey, TimeSpan expiresIn, CancellationToken ct = default)
    {
        var fullPath = GetFullPath(blobKey);

        if (!IsInsideBasePath(fullPath))
            return Task.FromResult(Result.Failure<string>("Invalid storage path", "VALIDATION_ERROR"));

        if (!File.Exists(fullPath))
            return Task.FromResult(Result.Failure<string>("Blob not found", "NOT_FOUND"));

        // Local storage returns a placeholder — FileStorageService overrides with the real download URL
        return Task.FromResult(Result.Success($"local://{blobKey}"));
    }

    private string GetFullPath(string blobKey)
    {
        return Path.Combine(_options.LocalBasePath, blobKey.Replace("/", Path.DirectorySeparatorChar.ToString()));
    }

    private bool IsInsideBasePath(string fullPath)
    {
        var resolvedBase = Path.GetFullPath(_options.LocalBasePath);
        var resolvedFull = Path.GetFullPath(fullPath);
        return resolvedFull.StartsWith(resolvedBase, StringComparison.OrdinalIgnoreCase);
    }

    private static string SanitizeName(string name)
    {
        return System.Text.RegularExpressions.Regex.Replace(name, @"[^a-zA-Z0-9_\-]", "");
    }
}
