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

public interface IAiUsageService
{
    Task LogUsageAsync(Guid userId, string provider, string model, int tokensIn, int tokensOut,
                       decimal estimatedCost, string? feature, int durationMs, decimal confidenceScore = 0m,
                       CancellationToken ct = default, Guid? companyId = null);
    Task<AiUsageSummaryDto> GetUsageSummaryAsync(DateOnly from, DateOnly to, CancellationToken ct = default);
    Task<List<AiUsageByUserDto>> GetUsageByUserAsync(DateOnly from, DateOnly to, CancellationToken ct = default);
    Task<List<AiUsageByProviderDto>> GetUsageByProviderAsync(DateOnly from, DateOnly to, CancellationToken ct = default);
    Task<List<AiDailyUsageDto>> GetDailyUsageAsync(DateOnly from, DateOnly to, CancellationToken ct = default);
    /// <summary>Per-company meter (2.19.6) — request counts in range for a company.</summary>
    Task<int> GetCompanyRequestCountAsync(Guid companyId, DateOnly from, DateOnly to, CancellationToken ct = default);
}

public record AiUsageSummaryDto(int TotalRequests, int TotalTokensIn, int TotalTokensOut, decimal TotalCost);
public record AiUsageByUserDto(Guid UserId, string UserName, int RequestCount, int TotalTokens, decimal TotalCost);
public record AiUsageByProviderDto(string Provider, int RequestCount, int TotalTokensIn, int TotalTokensOut, decimal TotalCost);
public record AiDailyUsageDto(DateOnly Date, int RequestCount, int TotalTokens, decimal TotalCost);
