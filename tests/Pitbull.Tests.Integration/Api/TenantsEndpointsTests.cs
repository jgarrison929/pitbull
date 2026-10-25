using System.Net;
using System.Net.Http.Json;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class TenantsEndpointsTests(PostgresFixture db) : IAsyncLifetime
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
    public async Task Get_current_tenant_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/tenants");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Get_current_tenant_returns_user_tenant()
    {
        await db.ResetAsync();

        var (client, _, tenantId) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync("/api/tenants");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();

        // Should contain tenant fields
        Assert.Contains("id", json);
        Assert.Contains("name", json);
        Assert.Contains("slug", json);
        Assert.Contains("status", json);
        Assert.Contains("plan", json);
        Assert.Contains(tenantId.ToString(), json);
    }

    [Fact]
    public async Task Get_tenant_by_id_for_own_tenant_returns_200()
    {
        await db.ResetAsync();

        var (client, _, tenantId) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync($"/api/tenants/{tenantId}");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        Assert.Contains(tenantId.ToString(), json);
    }

    [Fact]
    public async Task Get_tenant_by_id_for_other_tenant_returns_404()
    {
        await db.ResetAsync();

        var (clientA, _, _) = await _factory.CreateAuthenticatedClientAsync();
        var (_, _, tenantIdB) = await _factory.CreateAuthenticatedClientAsync();

        // Client A tries to access Client B's tenant - should get 404 (not 403)
        var resp = await clientA.GetAsync($"/api/tenants/{tenantIdB}");
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Get_tenant_by_nonexistent_id_returns_404()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var nonExistentId = Guid.NewGuid();
        var resp = await client.GetAsync($"/api/tenants/{nonExistentId}");

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Create_tenant_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.PostAsJsonAsync("/api/tenants", new { name = "Test Tenant" });

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Admin_can_create_tenant()
    {
        await db.ResetAsync();

        // First user is auto-promoted to Admin
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var tenantName = $"New Tenant {Guid.NewGuid():N}";
        var resp = await client.PostAsJsonAsync("/api/tenants", new { name = tenantName });

        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        Assert.Contains(tenantName, json);
        Assert.Contains("slug", json);
    }

    [Fact]
    public async Task Create_tenant_with_duplicate_name_returns_409()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var tenantName = $"Duplicate Test {Guid.NewGuid():N}";

        // Create first tenant
        var resp1 = await client.PostAsJsonAsync("/api/tenants", new { name = tenantName });
        Assert.Equal(HttpStatusCode.Created, resp1.StatusCode);

        // Try to create duplicate
        var resp2 = await client.PostAsJsonAsync("/api/tenants", new { name = tenantName });
        Assert.Equal(HttpStatusCode.Conflict, resp2.StatusCode);
    }
}
