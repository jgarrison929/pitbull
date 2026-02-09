using System.Net;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class MonitoringEndpointsTests(PostgresFixture db) : IAsyncLifetime
{
    private PitbullApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        _factory = new PitbullApiFactory(db.AppConnectionString);

        using var client = _factory.CreateClient();
        var resp = await client.GetAsync("/health/live");
        resp.EnsureSuccessStatusCode();
    }

    public async Task DisposeAsync()
    {
        _factory.Dispose();
        await Task.CompletedTask;
    }

    [Fact]
    public async Task Get_version_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/monitoring/version");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Get_version_returns_version_info()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync("/api/monitoring/version");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        
        // Should contain version info fields
        Assert.Contains("version", json);
        Assert.Contains("buildTime", json);
        Assert.Contains("environment", json);
        Assert.Contains("frameworkVersion", json);
        Assert.Contains("machineName", json);
    }

    [Fact]
    public async Task Get_health_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/monitoring/health");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Get_health_returns_health_status()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync("/api/monitoring/health");
        
        // Health check might return 200 (healthy) or 503 (unhealthy) - both are valid responses
        Assert.True(
            resp.StatusCode == HttpStatusCode.OK || resp.StatusCode == HttpStatusCode.ServiceUnavailable,
            $"Expected 200 or 503 but got {resp.StatusCode}");

        var json = await resp.Content.ReadAsStringAsync();
        Assert.Contains("status", json);
    }

    [Fact]
    public async Task Get_security_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/monitoring/security");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Get_security_returns_security_status()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync("/api/monitoring/security");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        
        // Should contain security status fields
        Assert.Contains("rateLimitingEnabled", json);
        Assert.Contains("httpsRedirection", json);
        Assert.Contains("securityHeadersEnabled", json);
        Assert.Contains("authenticationEnabled", json);
        Assert.Contains("requestSizeLimitsEnabled", json);
    }

    [Fact]
    public async Task Security_shows_authentication_enabled_for_authenticated_request()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync("/api/monitoring/security");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        
        // Authenticated request should show authenticationEnabled: true
        Assert.Contains("\"authenticationEnabled\":true", json);
    }
}
