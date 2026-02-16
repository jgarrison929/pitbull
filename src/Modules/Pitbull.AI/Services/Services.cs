using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Pitbull.AI.Domain;
using Pitbull.AI.Providers;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.AI.Services;

public class AiApiKeyService(
    PitbullDbContext db,
    IDataProtectionProvider dataProtectionProvider) : IAiApiKeyService
{
    public async Task<Result> StoreKeyAsync(Guid tenantId, string provider, string apiKey, DateTime? expiresAt = null, CancellationToken ct = default)
    {
        if (tenantId == Guid.Empty)
            return Result.Failure("Tenant is required", "VALIDATION_ERROR");
        if (string.IsNullOrWhiteSpace(provider) || string.IsNullOrWhiteSpace(apiKey))
            return Result.Failure("Provider and apiKey are required", "VALIDATION_ERROR");

        provider = provider.Trim().ToLowerInvariant();
        var protector = CreateProtector(tenantId, provider);
        var encrypted = protector.Protect(apiKey);

        var existing = await db.Set<AiApiKey>()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Provider == provider, ct);

        if (existing is null)
        {
            db.Set<AiApiKey>().Add(new AiApiKey
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Provider = provider,
                EncryptedApiKey = encrypted,
                KeyFingerprint = BuildFingerprint(apiKey),
                IsActive = true,
                ExpiresAt = expiresAt,
                CreatedAt = DateTime.UtcNow
            });
        }
        else
        {
            existing.EncryptedApiKey = encrypted;
            existing.KeyFingerprint = BuildFingerprint(apiKey);
            existing.ExpiresAt = expiresAt;
            existing.IsActive = true;
            existing.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }

    public async Task<Result<string>> GetDecryptedKeyAsync(Guid tenantId, string provider, CancellationToken ct = default)
    {
        provider = provider.Trim().ToLowerInvariant();
        var key = await db.Set<AiApiKey>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x =>
                x.TenantId == tenantId &&
                x.Provider == provider &&
                x.IsActive &&
                (x.ExpiresAt == null || x.ExpiresAt > DateTime.UtcNow), ct);

        if (key is null)
            return Result.Failure<string>("AI key not found", "NOT_FOUND");

        try
        {
            var protector = CreateProtector(tenantId, provider);
            var decrypted = protector.Unprotect(key.EncryptedApiKey);
            return Result.Success(decrypted);
        }
        catch
        {
            return Result.Failure<string>("Stored AI key cannot be decrypted", "DECRYPT_FAILED");
        }
    }

    public async Task<Result> RevokeKeyAsync(Guid tenantId, string provider, CancellationToken ct = default)
    {
        provider = provider.Trim().ToLowerInvariant();
        var key = await db.Set<AiApiKey>()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Provider == provider, ct);

        if (key is null)
            return Result.Failure("AI key not found", "NOT_FOUND");

        key.IsActive = false;
        key.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }

    private IDataProtector CreateProtector(Guid tenantId, string provider)
        => dataProtectionProvider.CreateProtector("Pitbull.AI.ApiKey", tenantId.ToString("D"), provider);

    private static string BuildFingerprint(string apiKey)
    {
        if (apiKey.Length <= 4)
            return apiKey;

        return $"***{apiKey[^4..]}";
    }
}

public class AiService(
    IEnumerable<IAiProvider> providers,
    IAiApiKeyService aiApiKeyService,
    IConfiguration configuration) : IAiService
{
    public async Task<Result<AiCompletionResult>> CompleteAsync(
        Guid tenantId,
        AiCompletionRequest request,
        string? providerOverride = null,
        CancellationToken ct = default)
    {
        var provider = ResolveProvider(request.Capability, providerOverride);
        if (provider is null)
            return Result.Failure<AiCompletionResult>("No AI provider available for requested capability", "NO_PROVIDER");

        var apiKeyResult = await aiApiKeyService.GetDecryptedKeyAsync(tenantId, provider.Name, ct);
        var apiKey = apiKeyResult.IsSuccess && !string.IsNullOrWhiteSpace(apiKeyResult.Value)
            ? apiKeyResult.Value!
            : GetFallbackApiKey(provider.Name);

        if (string.IsNullOrWhiteSpace(apiKey))
            return Result.Failure<AiCompletionResult>("AI API key is not configured", "AI_NOT_CONFIGURED");

        return await provider.CompleteAsync(request, apiKey, ct);
    }

    private IAiProvider? ResolveProvider(AiCapability capability, string? providerOverride)
    {
        if (!string.IsNullOrWhiteSpace(providerOverride))
        {
            var forced = providers.FirstOrDefault(p =>
                string.Equals(p.Name, providerOverride, StringComparison.OrdinalIgnoreCase));
            if (forced is not null && forced.Capabilities.Contains(capability))
                return forced;
            return null;
        }

        var preferredProvider = capability switch
        {
            AiCapability.Analysis or AiCapability.DocumentUnderstanding => "anthropic",
            AiCapability.Embedding or AiCapability.TextGeneration or AiCapability.CodeGeneration => "openai",
            _ => "openai"
        };

        return providers.FirstOrDefault(p =>
                   string.Equals(p.Name, preferredProvider, StringComparison.OrdinalIgnoreCase) &&
                   p.Capabilities.Contains(capability))
               ?? providers.FirstOrDefault(p => p.Capabilities.Contains(capability));
    }

    private string? GetFallbackApiKey(string providerName)
    {
        return providerName.ToLowerInvariant() switch
        {
            "anthropic" => configuration["ANTHROPIC_API_KEY"]
                            ?? configuration["Anthropic:ApiKey"]
                            ?? Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY"),
            "openai" => configuration["OPENAI_API_KEY"]
                         ?? configuration["OpenAI:ApiKey"]
                         ?? Environment.GetEnvironmentVariable("OPENAI_API_KEY"),
            _ => null
        };
    }
}
