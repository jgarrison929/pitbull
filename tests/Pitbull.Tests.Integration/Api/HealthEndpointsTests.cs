using System.Net;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class HealthEndpointsTests(PostgresFixture db) : IAsyncLifetime
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
    public async Task Health_live_is_public_and_returns_healthy()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/health/live");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var json = await resp.Content.ReadAsStringAsync();
        Assert.Contains("Healthy", json);
    }

    [Fact]
    public async Task Health_ready_is_public_and_returns_status()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/health/ready");

        // Ready check might return 200 (healthy) or 503 (unhealthy)
        Assert.True(
            resp.StatusCode == HttpStatusCode.OK || resp.StatusCode == HttpStatusCode.ServiceUnavailable,
            $"Expected 200 or 503 but got {resp.StatusCode}");
    }

    [Fact]
    public async Task Health_combined_is_public_and_returns_entries()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/health");

        // Combined health check returns 200 if all healthy, 503 if any unhealthy
        Assert.True(
            resp.StatusCode == HttpStatusCode.OK || resp.StatusCode == HttpStatusCode.ServiceUnavailable,
            $"Expected 200 or 503 but got {resp.StatusCode}");

        var json = await resp.Content.ReadAsStringAsync();
        // Should have entries array
        Assert.Contains("entries", json);
    }
}
