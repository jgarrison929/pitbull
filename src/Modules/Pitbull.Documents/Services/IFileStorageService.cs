using Pitbull.Core.CQRS;

namespace Pitbull.Documents.Services;

public interface IFileStorageService
{
    Task<Result<FileAttachmentDto>> UploadAsync(UploadFileCommand command, CancellationToken ct = default);
    Task<Result<FileDownloadResult>> DownloadAsync(Guid fileId, Guid userId, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid fileId, Guid userId, CancellationToken ct = default);
    Task<Result<string>> GetPresignedUrlAsync(Guid fileId, TimeSpan expiresIn, CancellationToken ct = default);
    Task<Result<IReadOnlyList<FileAttachmentDto>>> GetByEntityAsync(string entityType, Guid entityId, CancellationToken ct = default);
    Task<Result<FileAttachmentDto>> GetByIdAsync(Guid fileId, CancellationToken ct = default);
}

public record UploadFileCommand(
    string FileName,
    string ContentType,
    long FileSize,
    Stream Content,
    Guid UploadedById,
    string? RelatedEntityType = null,
    Guid? RelatedEntityId = null
);

public record FileAttachmentDto(
    Guid Id,
    string FileName,
    string ContentType,
    long FileSize,
    Guid UploadedById,
    DateTime CreatedAt,
    string? RelatedEntityType,
    Guid? RelatedEntityId
);

public record FileDownloadResult(
    Stream Content,
    string FileName,
    string ContentType,
    long FileSize
);
