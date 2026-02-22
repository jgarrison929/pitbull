using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.SystemAdmin.Domain;

namespace Pitbull.SystemAdmin.Services;

public class SecretVaultService(PitbullDbContext db) : ISecretVaultService
{
    public async Task<Result<SecretVaultListResult>> ListAsync(SecretCategory? category = null, CancellationToken ct = default)
    {
        var query = db.Set<SecretVault>().AsNoTracking().Where(s => !s.IsDeleted);

        if (category.HasValue)
            query = query.Where(s => s.Category == category.Value);

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderBy(s => s.Category)
            .ThenBy(s => s.Key)
            .Select(s => MapToDto(s))
            .ToListAsync(ct);

        return Result.Success(new SecretVaultListResult(items, totalCount));
    }

    public async Task<Result<SecretVaultDto>> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await db.Set<SecretVault>().AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted, ct);

        if (entity is null)
            return Result.Failure<SecretVaultDto>("Secret not found", "NOT_FOUND");

        return Result.Success(MapToDto(entity));
    }

    public async Task<Result<SecretVaultDto>> CreateAsync(CreateSecretVaultCommand command, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(command.Key))
            return Result.Failure<SecretVaultDto>("Secret key is required", "VALIDATION_ERROR");

        if (string.IsNullOrWhiteSpace(command.Value))
            return Result.Failure<SecretVaultDto>("Secret value is required", "VALIDATION_ERROR");

        if (!Enum.TryParse<SecretCategory>(command.Category, true, out var category))
            return Result.Failure<SecretVaultDto>("Invalid category", "VALIDATION_ERROR");

        var exists = await db.Set<SecretVault>()
            .AnyAsync(s => s.Key == command.Key.Trim() && !s.IsDeleted, ct);

        if (exists)
            return Result.Failure<SecretVaultDto>("A secret with this key already exists", "DUPLICATE_KEY");

        var entity = new SecretVault
        {
            Key = command.Key.Trim(),
            DisplayName = command.DisplayName?.Trim() ?? command.Key.Trim(),
            EncryptedValue = command.Value,
            KeyFingerprint = ComputeFingerprint(command.Value),
            Category = category,
            LastRotated = DateTime.UtcNow,
            Description = command.Description
        };

        db.Set<SecretVault>().Add(entity);
        await db.SaveChangesAsync(ct);

        return Result.Success(MapToDto(entity));
    }

    public async Task<Result<SecretVaultDto>> UpdateAsync(Guid id, UpdateSecretVaultCommand command, CancellationToken ct = default)
    {
        var entity = await db.Set<SecretVault>()
            .FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted, ct);

        if (entity is null)
            return Result.Failure<SecretVaultDto>("Secret not found", "NOT_FOUND");

        if (command.DisplayName is not null)
            entity.DisplayName = command.DisplayName.Trim();

        if (command.Description is not null)
            entity.Description = command.Description;

        if (command.Category is not null)
        {
            if (!Enum.TryParse<SecretCategory>(command.Category, true, out var category))
                return Result.Failure<SecretVaultDto>("Invalid category", "VALIDATION_ERROR");
            entity.Category = category;
        }

        if (!string.IsNullOrWhiteSpace(command.Value))
        {
            entity.EncryptedValue = command.Value;
            entity.KeyFingerprint = ComputeFingerprint(command.Value);
            entity.LastRotated = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(ct);

        return Result.Success(MapToDto(entity));
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await db.Set<SecretVault>()
            .FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted, ct);

        if (entity is null)
            return Result.Failure("Secret not found", "NOT_FOUND");

        entity.IsDeleted = true;
        entity.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }

    public async Task<string?> GetResolvedSecretAsync(string key, CancellationToken ct = default)
    {
        var entity = await db.Set<SecretVault>()
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Key == key && !s.IsDeleted, ct);

        return entity?.EncryptedValue;
    }

    private static string MaskValue(string value)
    {
        if (string.IsNullOrEmpty(value)) return "***";
        if (value.Length <= 8) return "***";
        return value[..4] + "..." + value[^4..];
    }

    private static string ComputeFingerprint(string value)
    {
        if (string.IsNullOrEmpty(value) || value.Length < 4) return "***";
        return value[..4];
    }

    private static SecretVaultDto MapToDto(SecretVault s) => new(
        s.Id,
        s.Key,
        s.DisplayName,
        MaskValue(s.EncryptedValue),
        s.KeyFingerprint,
        s.Category.ToString(),
        s.LastRotated,
        s.Description,
        s.CreatedAt);
}
