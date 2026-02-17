using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.SystemAdmin.Domain;

namespace Pitbull.SystemAdmin.Services;

public class ApiKeyService(PitbullDbContext db) : IApiKeyService
{
    public async Task<Result<ApiKeyListResult>> ListKeysAsync(int page = 1, int pageSize = 50, CancellationToken ct = default)
    {
        var query = db.Set<ApiKey>().AsNoTracking().Where(k => !k.IsDeleted);

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(k => k.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(k => MapToDto(k))
            .ToListAsync(ct);

        return Result.Success(new ApiKeyListResult(items, totalCount, page, pageSize));
    }

    public async Task<Result<ApiKeyCreatedDto>> CreateKeyAsync(CreateApiKeyCommand command, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(command.Name))
            return Result.Failure<ApiKeyCreatedDto>("API key name is required", "VALIDATION_ERROR");

        // Generate a secure random key
        var plainTextKey = GenerateApiKey();
        var keyHash = HashKey(plainTextKey);
        var keyPrefix = plainTextKey[..8];

        var apiKey = new ApiKey
        {
            Name = command.Name.Trim(),
            KeyHash = keyHash,
            KeyPrefix = keyPrefix,
            Description = command.Description,
            Scopes = command.Scopes,
            CreatedByEmail = string.Empty, // Set by controller
            Status = ApiKeyStatus.Active,
            ExpiresAt = command.ExpiresInDays.HasValue
                ? DateTime.UtcNow.AddDays(command.ExpiresInDays.Value)
                : null
        };

        db.Set<ApiKey>().Add(apiKey);
        await db.SaveChangesAsync(ct);

        return Result.Success(new ApiKeyCreatedDto(
            apiKey.Id, apiKey.Name, keyPrefix, plainTextKey,
            apiKey.Scopes, apiKey.ExpiresAt, apiKey.CreatedAt));
    }

    public async Task<Result> RevokeKeyAsync(Guid id, string revokedByEmail, CancellationToken ct = default)
    {
        var apiKey = await db.Set<ApiKey>().FirstOrDefaultAsync(k => k.Id == id && !k.IsDeleted, ct);
        if (apiKey is null)
            return Result.Failure("API key not found", "NOT_FOUND");

        if (apiKey.Status == ApiKeyStatus.Revoked)
            return Result.Failure("API key is already revoked", "ALREADY_REVOKED");

        apiKey.Status = ApiKeyStatus.Revoked;
        apiKey.RevokedAt = DateTime.UtcNow;
        apiKey.RevokedBy = revokedByEmail;

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }

    public async Task<Result> DeleteKeyAsync(Guid id, CancellationToken ct = default)
    {
        var apiKey = await db.Set<ApiKey>().FirstOrDefaultAsync(k => k.Id == id && !k.IsDeleted, ct);
        if (apiKey is null)
            return Result.Failure("API key not found", "NOT_FOUND");

        apiKey.IsDeleted = true;
        apiKey.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }

    private static string GenerateApiKey()
    {
        var bytes = new byte[32];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(bytes);
        return "pb_" + Convert.ToBase64String(bytes)
            .Replace("+", "")
            .Replace("/", "")
            .Replace("=", "")[..40];
    }

    private static string HashKey(string plainTextKey)
    {
        var bytes = System.Text.Encoding.UTF8.GetBytes(plainTextKey);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexStringLower(hash);
    }

    private static ApiKeyDto MapToDto(ApiKey k) => new(
        k.Id, k.Name, k.KeyPrefix, k.Status.ToString(),
        k.ExpiresAt, k.LastUsedAt, k.Scopes, k.Description,
        k.CreatedByEmail, k.CreatedAt, k.RevokedAt, k.RevokedBy);
}
