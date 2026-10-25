using Pitbull.Core.CQRS;
using Pitbull.SystemAdmin.Domain;

namespace Pitbull.SystemAdmin.Services;

public interface ISecretVaultService
{
    Task<Result<SecretVaultListResult>> ListAsync(SecretCategory? category = null, CancellationToken ct = default);
    Task<Result<SecretVaultDto>> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Result<SecretVaultDto>> CreateAsync(CreateSecretVaultCommand command, CancellationToken ct = default);
    Task<Result<SecretVaultDto>> UpdateAsync(Guid id, UpdateSecretVaultCommand command, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid id, CancellationToken ct = default);
    Task<string?> GetResolvedSecretAsync(string key, CancellationToken ct = default);
}

public record SecretVaultDto(
    Guid Id,
    string Key,
    string DisplayName,
    string MaskedValue,
    string KeyFingerprint,
    string Category,
    DateTime LastRotated,
    string? Description,
    DateTime CreatedAt
);

public record SecretVaultListResult(
    List<SecretVaultDto> Items,
    int TotalCount
);

public record CreateSecretVaultCommand(
    string Key,
    string DisplayName,
    string Value,
    string Category,
    string? Description
);

public record UpdateSecretVaultCommand(
    string? DisplayName,
    string? Value,
    string? Category,
    string? Description
);
