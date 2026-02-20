using Pitbull.Core.MultiTenancy;

namespace Pitbull.Api.Services;

/// <summary>
/// Thin wrapper around IMemoryCache for multi-tenant-safe caching.
/// Cache keys are automatically scoped by TenantId + CompanyId.
/// </summary>
public interface ICacheService
{
    /// <summary>
    /// Gets or creates a cached value using the factory function.
    /// The cache key is automatically scoped by TenantId and CompanyId.
    /// </summary>
    Task<T> GetOrCreateAsync<T>(string key, Func<Task<T>> factory, TimeSpan expiry);

    /// <summary>
    /// Removes a cached entry. The key is automatically scoped by TenantId and CompanyId.
    /// </summary>
    void Remove(string key);
}
