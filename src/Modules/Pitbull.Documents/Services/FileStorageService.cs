using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.MultiTenancy;
using Pitbull.Core.Services.BlobStorage;
using Pitbull.Documents.Domain;

namespace Pitbull.Documents.Services;

public class FileStorageService(
    PitbullDbContext db,
    ITenantContext tenantContext,
    IFileValidationService fileValidationService,
    IBlobStorageService blobStorageService) : IFileStorageService
{
    public async Task<Result<FileAttachmentDto>> UploadAsync(UploadFileCommand command, CancellationToken ct = default)
    {
        var validationResult = fileValidationService.ValidateFile(command.FileName, command.ContentType, command.FileSize);
        if (!validationResult.IsSuccess)
            return Result.Failure<FileAttachmentDto>(validationResult.Error!, validationResult.ErrorCode);

        var containerName = SanitizeEntityType(command.RelatedEntityType ?? "general");
        var blobResult = await blobStorageService.UploadAsync(
            command.Content, command.FileName, command.ContentType,
            tenantContext.TenantId, containerName, ct);

        if (!blobResult.IsSuccess)
            return Result.Failure<FileAttachmentDto>(blobResult.Error!, blobResult.ErrorCode);

        var blob = blobResult.Value!;
        var attachment = new FileAttachment
        {
            FileName = command.FileName,
            ContentType = command.ContentType,
            FileSize = command.FileSize > 0 ? command.FileSize : blob.Size,
            StoragePath = blob.Key,
            UploadedById = command.UploadedById,
            RelatedEntityType = command.RelatedEntityType,
            RelatedEntityId = command.RelatedEntityId,
        };

        db.Set<FileAttachment>().Add(attachment);
        await db.SaveChangesAsync(ct);

        return Result.Success(ToDto(attachment));
    }

    public async Task<Result<FileDownloadResult>> DownloadAsync(Guid fileId, Guid userId, CancellationToken ct = default)
    {
        var attachment = await db.Set<FileAttachment>()
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == fileId && !f.IsDeleted, ct);

        if (attachment is null)
            return Result.Failure<FileDownloadResult>("File not found", "NOT_FOUND");

        var streamResult = await blobStorageService.DownloadAsync(attachment.StoragePath, ct);
        if (!streamResult.IsSuccess)
            return Result.Failure<FileDownloadResult>(streamResult.Error!, streamResult.ErrorCode);

        return Result.Success(new FileDownloadResult(streamResult.Value!, attachment.FileName, attachment.ContentType, attachment.FileSize));
    }

    public async Task<Result> DeleteAsync(Guid fileId, Guid userId, CancellationToken ct = default)
    {
        var attachment = await db.Set<FileAttachment>()
            .FirstOrDefaultAsync(f => f.Id == fileId && !f.IsDeleted, ct);

        if (attachment is null)
            return Result.Failure("File not found", "NOT_FOUND");

        // Soft-delete the DB record; blob remains for audit trail
        attachment.IsDeleted = true;
        attachment.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }

    public async Task<Result<string>> GetPresignedUrlAsync(Guid fileId, TimeSpan expiresIn, CancellationToken ct = default)
    {
        var attachment = await db.Set<FileAttachment>()
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == fileId && !f.IsDeleted, ct);

        if (attachment is null)
            return Result.Failure<string>("File not found", "NOT_FOUND");

        var urlResult = await blobStorageService.GetPresignedUrlAsync(attachment.StoragePath, expiresIn, ct);
        if (!urlResult.IsSuccess)
            return urlResult;

        // Local provider returns a placeholder — replace with the real download route
        if (urlResult.Value!.StartsWith("local://", StringComparison.Ordinal))
            return Result.Success($"/api/files/{fileId}/download");

        return urlResult;
    }

    public async Task<Result<IReadOnlyList<FileAttachmentDto>>> GetByEntityAsync(string entityType, Guid entityId, CancellationToken ct = default)
    {
        var attachments = await db.Set<FileAttachment>()
            .AsNoTracking()
            .Where(f => f.RelatedEntityType == entityType && f.RelatedEntityId == entityId && !f.IsDeleted)
            .OrderByDescending(f => f.CreatedAt)
            .Select(f => ToDto(f))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<FileAttachmentDto>>(attachments);
    }

    public async Task<Result<FileAttachmentDto>> GetByIdAsync(Guid fileId, CancellationToken ct = default)
    {
        var attachment = await db.Set<FileAttachment>()
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == fileId && !f.IsDeleted, ct);

        if (attachment is null)
            return Result.Failure<FileAttachmentDto>("File not found", "NOT_FOUND");

        return Result.Success(ToDto(attachment));
    }

    private static FileAttachmentDto ToDto(FileAttachment f) => new(
        f.Id, f.FileName, f.ContentType, f.FileSize,
        f.UploadedById, f.CreatedAt,
        f.RelatedEntityType, f.RelatedEntityId
    );

    private static string SanitizeEntityType(string entityType)
    {
        var sanitized = System.Text.RegularExpressions.Regex.Replace(entityType, @"[^a-zA-Z0-9_\-]", "");
        return string.IsNullOrWhiteSpace(sanitized) ? "general" : sanitized;
    }
}
