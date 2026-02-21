using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.MultiTenancy;
using Pitbull.Documents.Domain;

namespace Pitbull.Documents.Services;

public class FileStorageService(PitbullDbContext db, IConfiguration configuration, ITenantContext tenantContext, IFileValidationService fileValidationService) : IFileStorageService
{
    private string GetBasePath()
    {
        var configuredPath = configuration["FileStorage:BasePath"];
        var basePath = string.IsNullOrWhiteSpace(configuredPath)
            ? Path.Combine(AppContext.BaseDirectory, "uploads")
            : configuredPath;
        Directory.CreateDirectory(basePath);
        return basePath;
    }

    public async Task<Result<FileAttachmentDto>> UploadAsync(UploadFileCommand command, CancellationToken ct = default)
    {
        var validationResult = fileValidationService.ValidateFile(command.FileName, command.ContentType, command.FileSize);
        if (!validationResult.IsSuccess)
            return Result.Failure<FileAttachmentDto>(validationResult.Error!, validationResult.ErrorCode);

        var basePath = GetBasePath();
        var tenantFolder = tenantContext.TenantId != Guid.Empty ? tenantContext.TenantId.ToString("N") : "default";
        var entityFolder = SanitizeEntityType(command.RelatedEntityType ?? "general");
        var safeFileName = $"{Guid.NewGuid():N}_{SanitizeFileName(command.FileName)}";
        var relativePath = Path.Combine(tenantFolder, entityFolder, safeFileName);
        var fullPath = Path.Combine(basePath, relativePath);

        // Guard: ensure resolved path stays within the base directory
        var resolvedBase = Path.GetFullPath(basePath);
        var resolvedFull = Path.GetFullPath(fullPath);
        if (!resolvedFull.StartsWith(resolvedBase, StringComparison.OrdinalIgnoreCase))
            return Result.Failure<FileAttachmentDto>("Invalid storage path", "VALIDATION_ERROR");

        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);

        await using (var fileStream = new FileStream(fullPath, FileMode.Create, FileAccess.Write))
        {
            await command.Content.CopyToAsync(fileStream, ct);
        }

        var attachment = new FileAttachment
        {
            FileName = command.FileName,
            ContentType = command.ContentType,
            FileSize = command.FileSize,
            StoragePath = relativePath.Replace("\\", "/"),
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

        var basePath = GetBasePath();
        var fullPath = Path.Combine(basePath, attachment.StoragePath.Replace("/", Path.DirectorySeparatorChar.ToString()));

        if (!File.Exists(fullPath))
            return Result.Failure<FileDownloadResult>("File not found on disk", "FILE_MISSING");

        var stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        return Result.Success(new FileDownloadResult(stream, attachment.FileName, attachment.ContentType, attachment.FileSize));
    }

    public async Task<Result> DeleteAsync(Guid fileId, Guid userId, CancellationToken ct = default)
    {
        var attachment = await db.Set<FileAttachment>()
            .FirstOrDefaultAsync(f => f.Id == fileId && !f.IsDeleted, ct);

        if (attachment is null)
            return Result.Failure("File not found", "NOT_FOUND");

        attachment.IsDeleted = true;
        attachment.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        return Result.Success();
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
        // Only allow alphanumeric, hyphens, underscores — strip everything else
        var sanitized = System.Text.RegularExpressions.Regex.Replace(entityType, @"[^a-zA-Z0-9_\-]", "");
        return string.IsNullOrWhiteSpace(sanitized) ? "general" : sanitized;
    }

    private static string SanitizeFileName(string fileName)
    {
        var invalidChars = Path.GetInvalidFileNameChars();
        var sanitized = string.Join("_", fileName.Split(invalidChars, StringSplitOptions.RemoveEmptyEntries));
        return string.IsNullOrWhiteSpace(sanitized) ? "file" : sanitized;
    }
}
