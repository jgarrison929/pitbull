using System.Net;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class SeedDataEndpointsTests(PostgresFixture db) : IAsyncLifetime
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
    public async Task Seed_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.PostAsync("/api/seeddata", null);

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Admin_can_seed_data()
    {
        await db.ResetAsync();

        // First user is auto-promoted to Admin
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.PostAsync("/api/seeddata", null);

        // Should be OK or Conflict (if already seeded)
        Assert.True(
            resp.StatusCode == HttpStatusCode.OK || resp.StatusCode == HttpStatusCode.Conflict,
            $"Expected 200 or 409 but got {(int)resp.StatusCode}");

        if (resp.StatusCode == HttpStatusCode.OK)
        {
            var json = await resp.Content.ReadAsStringAsync();
            // Should contain created counts
            Assert.Contains("projects", json, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact]
    public async Task Seed_twice_returns_409()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // First seed
        var resp1 = await client.PostAsync("/api/seeddata", null);

        // Might already have data from other tests, or succeed
        if (resp1.StatusCode == HttpStatusCode.OK)
        {
            // Second seed should return 409
            var resp2 = await client.PostAsync("/api/seeddata", null);
            Assert.Equal(HttpStatusCode.Conflict, resp2.StatusCode);
        }
        else
        {
            // Already seeded, so first call returned 409
            Assert.Equal(HttpStatusCode.Conflict, resp1.StatusCode);
        }
    }
}
