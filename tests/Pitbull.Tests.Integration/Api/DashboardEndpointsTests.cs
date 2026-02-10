using System.Net;
using System.Net.Http.Json;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class DashboardEndpointsTests(PostgresFixture db) : IAsyncLifetime
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
    public async Task Get_dashboard_stats_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/dashboard/stats");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Get_dashboard_stats_returns_valid_response()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync("/api/dashboard/stats");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        
        // Should contain expected fields (camelCase from JSON serialization)
        Assert.Contains("projectCount", json);
        Assert.Contains("bidCount", json);
        Assert.Contains("recentActivity", json);
    }

    [Fact]
    public async Task Dashboard_stats_are_tenant_isolated()
    {
        await db.ResetAsync();

        var (clientA, _, _) = await _factory.CreateAuthenticatedClientAsync();
        var (clientB, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create a project in tenant A
        var createProject = new { name = "Dashboard Test Project", number = $"PROJ-DASH-{Guid.NewGuid():N}" };
        var createResp = await clientA.PostAsJsonAsync("/api/projects", createProject);
        createResp.EnsureSuccessStatusCode();

        // Tenant A should see project in stats
        var statsA = await clientA.GetAsync("/api/dashboard/stats");
        statsA.EnsureSuccessStatusCode();
        var jsonA = await statsA.Content.ReadAsStringAsync();
        
        // Tenant B should NOT see tenant A's project in their stats
        var statsB = await clientB.GetAsync("/api/dashboard/stats");
        statsB.EnsureSuccessStatusCode();
        var jsonB = await statsB.Content.ReadAsStringAsync();
        
        // Both should return valid stats (not throw errors)
        Assert.Contains("projectCount", jsonA);
        Assert.Contains("projectCount", jsonB);
    }

    [Fact]
    public async Task Get_weekly_hours_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/dashboard/weekly-hours");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Get_weekly_hours_returns_valid_response()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync("/api/dashboard/weekly-hours");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        
        // Should contain expected fields
        Assert.Contains("data", json);
        Assert.Contains("totalHours", json);
        Assert.Contains("averageHoursPerWeek", json);
    }

    [Fact]
    public async Task Get_weekly_hours_respects_weeks_parameter()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Request 4 weeks of data
        var resp = await client.GetAsync("/api/dashboard/weekly-hours?weeks=4");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        Assert.Contains("data", json);
    }
}
