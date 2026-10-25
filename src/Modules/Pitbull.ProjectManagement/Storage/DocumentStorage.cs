using Pitbull.Core.CQRS;
using Pitbull.ProjectManagement.Domain;

namespace Pitbull.ProjectManagement.Storage;

public record DocumentUploadRequest(string FileName, string MimeType, byte[] Content, Guid CompanyId, Guid ProjectId, Guid UploadedByUserId);
public record DocumentUploadResult(string StoragePath, long FileSizeBytes, string Checksum, DocumentStorageProvider Provider);

public interface IDocumentStorageProvider
{
    DocumentStorageProvider Provider { get; }
    Task<Result<DocumentUploadResult>> SaveAsync(DocumentUploadRequest request, CancellationToken cancellationToken = default);
}

public interface IS3CompatibleDocumentStorageProvider : IDocumentStorageProvider;
public interface IAzureBlobDocumentStorageProvider : IDocumentStorageProvider;

public class LocalFileSystemDocumentStorageProvider : IDocumentStorageProvider
{
    private readonly string _basePath;

    public LocalFileSystemDocumentStorageProvider()
    {
        _basePath = Path.Combine(AppContext.BaseDirectory, "pm-documents");
        Directory.CreateDirectory(_basePath);
    }

    public DocumentStorageProvider Provider => DocumentStorageProvider.LocalFileSystem;

    public async Task<Result<DocumentUploadResult>> SaveAsync(DocumentUploadRequest request, CancellationToken cancellationToken = default)
    {
        var checksum = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(request.Content));
        var fileName = $"{Guid.NewGuid():N}_{request.FileName}";
        var relativePath = Path.Combine(request.CompanyId.ToString("N"), request.ProjectId.ToString("N"), fileName);
        var fullPath = Path.Combine(_basePath, relativePath);

        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
        await File.WriteAllBytesAsync(fullPath, request.Content, cancellationToken);

        return Result.Success(new DocumentUploadResult(relativePath.Replace("\\", "/"), request.Content.LongLength, checksum, Provider));
    }
}
