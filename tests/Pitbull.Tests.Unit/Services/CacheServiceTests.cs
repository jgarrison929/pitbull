using FluentAssertions;
using Microsoft.Extensions.Caching.Memory;
using Moq;
using Pitbull.Api.Services;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Tests.Unit.Services;

public class CacheServiceTests
{
    private readonly IMemoryCache _memoryCache;
    private readonly Mock<ITenantContext> _tenantContext;
    private readonly Mock<ICompanyContext> _companyContext;
    private readonly CacheService _sut;

    private static readonly Guid TenantId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid CompanyId = Guid.Parse("22222222-2222-2222-2222-222222222222");

    public CacheServiceTests()
    {
        _memoryCache = new MemoryCache(new MemoryCacheOptions());
        _tenantContext = new Mock<ITenantContext>();
        _companyContext = new Mock<ICompanyContext>();

        _tenantContext.Setup(t => t.TenantId).Returns(TenantId);
        _companyContext.Setup(c => c.CompanyId).Returns(CompanyId);

        _sut = new CacheService(_memoryCache, _tenantContext.Object, _companyContext.Object);
    }

    [Fact]
    public async Task GetOrCreateAsync_CallsFactory_WhenCacheMiss()
    {
        var factoryCalled = false;

        var result = await _sut.GetOrCreateAsync("test-key", async () =>
        {
            factoryCalled = true;
            return await Task.FromResult("hello");
        }, TimeSpan.FromMinutes(5));

        factoryCalled.Should().BeTrue();
        result.Should().Be("hello");
    }

    [Fact]
    public async Task GetOrCreateAsync_ReturnsCachedValue_OnSecondCall()
    {
        var callCount = 0;

        async Task<string> Factory()
        {
            callCount++;
            return await Task.FromResult($"value-{callCount}");
        }

        var first = await _sut.GetOrCreateAsync("test-key", Factory, TimeSpan.FromMinutes(5));
        var second = await _sut.GetOrCreateAsync("test-key", Factory, TimeSpan.FromMinutes(5));

        callCount.Should().Be(1, "factory should only be called once");
        first.Should().Be("value-1");
        second.Should().Be("value-1");
    }

    [Fact]
    public async Task GetOrCreateAsync_CachesComplexObjects()
    {
        var data = new List<string> { "account-1", "account-2", "account-3" };

        var result1 = await _sut.GetOrCreateAsync("complex", () => Task.FromResult(data), TimeSpan.FromMinutes(5));
        var result2 = await _sut.GetOrCreateAsync("complex", () => Task.FromResult(new List<string>()), TimeSpan.FromMinutes(5));

        result1.Should().BeEquivalentTo(data);
        result2.Should().BeEquivalentTo(data, "should return cached value, not empty list from second factory");
    }

    [Fact]
    public async Task Remove_InvalidatesCache()
    {
        var callCount = 0;

        async Task<string> Factory()
        {
            callCount++;
            return await Task.FromResult($"value-{callCount}");
        }

        await _sut.GetOrCreateAsync("test-key", Factory, TimeSpan.FromMinutes(5));
        callCount.Should().Be(1);

        _sut.Remove("test-key");

        var afterRemove = await _sut.GetOrCreateAsync("test-key", Factory, TimeSpan.FromMinutes(5));
        callCount.Should().Be(2, "factory should be called again after cache removal");
        afterRemove.Should().Be("value-2");
    }

    [Fact]
    public async Task GetOrCreateAsync_IsolatesTenants()
    {
        var tenantA = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var tenantB = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

        var tenantContextA = new Mock<ITenantContext>();
        tenantContextA.Setup(t => t.TenantId).Returns(tenantA);
        var serviceA = new CacheService(_memoryCache, tenantContextA.Object, _companyContext.Object);

        var tenantContextB = new Mock<ITenantContext>();
        tenantContextB.Setup(t => t.TenantId).Returns(tenantB);
        var serviceB = new CacheService(_memoryCache, tenantContextB.Object, _companyContext.Object);

        await serviceA.GetOrCreateAsync("data", () => Task.FromResult("tenant-a-data"), TimeSpan.FromMinutes(5));
        var resultB = await serviceB.GetOrCreateAsync("data", () => Task.FromResult("tenant-b-data"), TimeSpan.FromMinutes(5));

        resultB.Should().Be("tenant-b-data", "different tenant should not see tenant A's cached data");
    }

    [Fact]
    public async Task GetOrCreateAsync_IsolatesCompanies()
    {
        var companyA = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var companyB = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

        var companyContextA = new Mock<ICompanyContext>();
        companyContextA.Setup(c => c.CompanyId).Returns(companyA);
        var serviceA = new CacheService(_memoryCache, _tenantContext.Object, companyContextA.Object);

        var companyContextB = new Mock<ICompanyContext>();
        companyContextB.Setup(c => c.CompanyId).Returns(companyB);
        var serviceB = new CacheService(_memoryCache, _tenantContext.Object, companyContextB.Object);

        await serviceA.GetOrCreateAsync("data", () => Task.FromResult("company-a-data"), TimeSpan.FromMinutes(5));
        var resultB = await serviceB.GetOrCreateAsync("data", () => Task.FromResult("company-b-data"), TimeSpan.FromMinutes(5));

        resultB.Should().Be("company-b-data", "different company should not see company A's cached data");
    }

    [Fact]
    public async Task Remove_OnlyAffectsCorrectTenantAndCompany()
    {
        var tenantA = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var tenantB = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

        var tenantContextA = new Mock<ITenantContext>();
        tenantContextA.Setup(t => t.TenantId).Returns(tenantA);
        var serviceA = new CacheService(_memoryCache, tenantContextA.Object, _companyContext.Object);

        var tenantContextB = new Mock<ITenantContext>();
        tenantContextB.Setup(t => t.TenantId).Returns(tenantB);
        var serviceB = new CacheService(_memoryCache, tenantContextB.Object, _companyContext.Object);

        await serviceA.GetOrCreateAsync("data", () => Task.FromResult("tenant-a-data"), TimeSpan.FromMinutes(5));
        await serviceB.GetOrCreateAsync("data", () => Task.FromResult("tenant-b-data"), TimeSpan.FromMinutes(5));

        // Remove tenant A's cache
        serviceA.Remove("data");

        // Tenant B should still have cached data
        var callCount = 0;
        var resultB = await serviceB.GetOrCreateAsync("data", () =>
        {
            callCount++;
            return Task.FromResult("tenant-b-fresh");
        }, TimeSpan.FromMinutes(5));

        callCount.Should().Be(0, "tenant B's cache should not be affected by tenant A's removal");
        resultB.Should().Be("tenant-b-data");
    }

    [Fact]
    public void BuildScopedKey_IncludesTenantAndCompany()
    {
        var key = _sut.BuildScopedKey("chart-of-accounts:tree");

        key.Should().Be($"tenant:{TenantId}:company:{CompanyId}:chart-of-accounts:tree");
    }

    [Fact]
    public async Task GetOrCreateAsync_RespectsExpiry()
    {
        // Use a very short TTL
        var shortCache = new MemoryCache(new MemoryCacheOptions());
        var sut = new CacheService(shortCache, _tenantContext.Object, _companyContext.Object);

        var callCount = 0;
        await sut.GetOrCreateAsync("expiry-test", () =>
        {
            callCount++;
            return Task.FromResult("value");
        }, TimeSpan.FromMilliseconds(50));

        callCount.Should().Be(1);

        // Wait for expiry
        await Task.Delay(100);

        await sut.GetOrCreateAsync("expiry-test", () =>
        {
            callCount++;
            return Task.FromResult("value-2");
        }, TimeSpan.FromMinutes(5));

        callCount.Should().Be(2, "factory should be called again after expiry");
    }

    [Fact]
    public async Task GetOrCreateAsync_DifferentKeys_AreCachedIndependently()
    {
        await _sut.GetOrCreateAsync("key-a", () => Task.FromResult("value-a"), TimeSpan.FromMinutes(5));
        await _sut.GetOrCreateAsync("key-b", () => Task.FromResult("value-b"), TimeSpan.FromMinutes(5));

        // Remove only key-a
        _sut.Remove("key-a");

        var callCount = 0;
        var resultA = await _sut.GetOrCreateAsync("key-a", () =>
        {
            callCount++;
            return Task.FromResult("value-a-fresh");
        }, TimeSpan.FromMinutes(5));

        var resultB = await _sut.GetOrCreateAsync("key-b", () =>
        {
            callCount++;
            return Task.FromResult("value-b-fresh");
        }, TimeSpan.FromMinutes(5));

        callCount.Should().Be(1, "only key-a should have been evicted");
        resultA.Should().Be("value-a-fresh");
        resultB.Should().Be("value-b", "key-b should still be cached");
    }
}
