using System.Net;
using System.Net.Http.Json;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class CostCodesEndpointsTests(PostgresFixture db) : IAsyncLifetime
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
    public async Task Get_cost_codes_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/cost-codes");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Get_cost_codes_returns_paginated_list()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync("/api/cost-codes");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();

        // Response should have pagination structure
        Assert.Contains("items", json);
        Assert.Contains("totalCount", json);
        Assert.Contains("page", json);
        Assert.Contains("pageSize", json);
        Assert.Contains("totalPages", json);
    }

    [Fact]
    public async Task Get_cost_codes_supports_search_filter()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Search for a non-existent term should return empty items
        var resp = await client.GetAsync("/api/cost-codes?search=NONEXISTENT12345");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        Assert.Contains("\"items\":[]", json);
        Assert.Contains("\"totalCount\":0", json);
    }

    [Fact]
    public async Task Get_cost_codes_supports_cost_type_filter()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Filter by Labor type (enum value = 1)
        var resp = await client.GetAsync("/api/cost-codes?costType=1");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        Assert.Contains("items", json);
        // Should not error on valid cost type filter
    }

    [Fact]
    public async Task Get_cost_codes_supports_inactive_filter()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Request including inactive codes
        var resp = await client.GetAsync("/api/cost-codes?isActive=false");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        Assert.Contains("items", json);
    }

    [Fact]
    public async Task Get_cost_code_by_id_returns_404_for_nonexistent()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var nonExistentId = Guid.NewGuid();
        var resp = await client.GetAsync($"/api/cost-codes/{nonExistentId}");

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Get_cost_code_by_id_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync($"/api/cost-codes/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Get_cost_codes_supports_pagination()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Request specific page and page size
        var resp = await client.GetAsync("/api/cost-codes?page=2&pageSize=10");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        Assert.Contains("\"page\":2", json);
        Assert.Contains("\"pageSize\":10", json);
    }
}
