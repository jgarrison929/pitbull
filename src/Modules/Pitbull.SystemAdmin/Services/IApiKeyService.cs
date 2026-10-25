using Pitbull.Core.CQRS;

namespace Pitbull.SystemAdmin.Services;

public interface IApiKeyService
{
    Task<Result<ApiKeyListResult>> ListKeysAsync(int page = 1, int pageSize = 50, CancellationToken ct = default);
    Task<Result<ApiKeyCreatedDto>> CreateKeyAsync(CreateApiKeyCommand command, CancellationToken ct = default);
    Task<Result> RevokeKeyAsync(Guid id, string revokedByEmail, CancellationToken ct = default);
    Task<Result> DeleteKeyAsync(Guid id, CancellationToken ct = default);
}

public record ApiKeyDto(
    Guid Id,
    string Name,
    string KeyPrefix,
    string Status,
    DateTime? ExpiresAt,
    DateTime? LastUsedAt,
    string? Scopes,
    string? Description,
    string CreatedByEmail,
    DateTime CreatedAt,
    DateTime? RevokedAt,
    string? RevokedBy
);

public record ApiKeyCreatedDto(
    Guid Id,
    string Name,
    string KeyPrefix,
    string PlainTextKey, // Only returned on creation
    string? Scopes,
    DateTime? ExpiresAt,
    DateTime CreatedAt
);

public record ApiKeyListResult(
    List<ApiKeyDto> Items,
    int TotalCount,
    int Page,
    int PageSize
);

public record CreateApiKeyCommand(
    string Name,
    string? Description,
    string? Scopes,
    int? ExpiresInDays
);
