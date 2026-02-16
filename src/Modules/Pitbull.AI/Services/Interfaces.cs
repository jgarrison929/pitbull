using Pitbull.AI.Domain;
using Pitbull.AI.Providers;
using Pitbull.Core.CQRS;

namespace Pitbull.AI.Services;

public interface IAiApiKeyService
{
    Task<Result> StoreKeyAsync(Guid tenantId, string provider, string apiKey, DateTime? expiresAt = null, CancellationToken ct = default);
    Task<Result<string>> GetDecryptedKeyAsync(Guid tenantId, string provider, CancellationToken ct = default);
    Task<Result> RevokeKeyAsync(Guid tenantId, string provider, CancellationToken ct = default);
}

public interface IAiService
{
    Task<Result<AiCompletionResult>> CompleteAsync(
        Guid tenantId,
        AiCompletionRequest request,
        string? providerOverride = null,
        CancellationToken ct = default);
}
