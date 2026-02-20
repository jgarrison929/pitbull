using Microsoft.Extensions.Caching.Memory;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Api.Services;

/// <summary>
/// Multi-tenant-safe in-memory cache service.
/// All keys are automatically scoped by TenantId and CompanyId to prevent cross-tenant data leakage.
/// </summary>
public class CacheService : ICacheService
{
    private readonly IMemoryCache _cache;
    private readonly ITenantContext _tenantContext;
    private readonly ICompanyContext _companyContext;

    public CacheService(IMemoryCache cache, ITenantContext tenantContext, ICompanyContext companyContext)
    {
        _cache = cache;
        _tenantContext = tenantContext;
        _companyContext = companyContext;
    }

    public async Task<T> GetOrCreateAsync<T>(string key, Func<Task<T>> factory, TimeSpan expiry)
    {
        var scopedKey = BuildScopedKey(key);

        if (_cache.TryGetValue(scopedKey, out T? cached) && cached is not null)
            return cached;

        var value = await factory();

        var options = new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = expiry
        };

        _cache.Set(scopedKey, value, options);
        return value;
    }

    public void Remove(string key)
    {
        var scopedKey = BuildScopedKey(key);
        _cache.Remove(scopedKey);
    }

    /// <summary>
    /// Builds a cache key scoped by the current tenant and company.
    /// Visible for testing.
    /// </summary>
    public string BuildScopedKey(string key)
    {
        return $"tenant:{_tenantContext.TenantId}:company:{_companyContext.CompanyId}:{key}";
    }
}
