using System.Net;
using System.Net.Http.Json;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class UsersEndpointsTests(PostgresFixture db) : IAsyncLifetime
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
    public async Task List_users_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/users");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task List_users_returns_paginated_users()
    {
        await db.ResetAsync();

        // First user gets Admin role
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync("/api/users");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();

        // Should have pagination structure
        Assert.Contains("items", json);
        Assert.Contains("totalCount", json);
        Assert.Contains("page", json);
        Assert.Contains("pageSize", json);
    }

    [Fact]
    public async Task Get_user_by_id_returns_user_details()
    {
        await db.ResetAsync();

        var (client, auth, _) = await _factory.CreateAuthenticatedClientAsync();
        var userId = auth.UserId;

        var resp = await client.GetAsync($"/api/users/{userId}");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        Assert.Contains(userId.ToString(), json);
        Assert.Contains("email", json);
        Assert.Contains("roles", json);
    }

    [Fact]
    public async Task Get_user_by_nonexistent_id_returns_404()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var nonExistentId = Guid.NewGuid();
        var resp = await client.GetAsync($"/api/users/{nonExistentId}");

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Get_available_roles_returns_role_list()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync("/api/users/roles");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        // Should contain role info with names and descriptions
        Assert.Contains("name", json);
        Assert.Contains("description", json);
    }

    [Fact]
    public async Task List_users_supports_search_filter()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Search for non-existent user
        var resp = await client.GetAsync("/api/users?search=NONEXISTENT12345");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        Assert.Contains("\"items\":[]", json);
        Assert.Contains("\"totalCount\":0", json);
    }

    [Fact]
    public async Task List_users_supports_pagination_params()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync("/api/users?page=2&pageSize=5");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        Assert.Contains("\"page\":2", json);
        Assert.Contains("\"pageSize\":5", json);
    }

    [Fact]
    public async Task Assign_role_returns_401_without_auth()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.PostAsJsonAsync($"/api/users/{Guid.NewGuid()}/roles", new { Role = "Manager" });

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Assign_role_to_nonexistent_user_returns_404()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.PostAsJsonAsync($"/api/users/{Guid.NewGuid()}/roles", new { Role = "Manager" });

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Assign_invalid_role_returns_400()
    {
        await db.ResetAsync();
        var (client, auth, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.PostAsJsonAsync($"/api/users/{auth.UserId}/roles", new { Role = "InvalidRole123" });

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var json = await resp.Content.ReadAsStringAsync();
        Assert.Contains("Invalid role", json);
    }

    [Fact]
    public async Task Remove_role_returns_401_without_auth()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.DeleteAsync($"/api/users/{Guid.NewGuid()}/roles/Manager");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Remove_invalid_role_returns_400()
    {
        await db.ResetAsync();
        var (client, auth, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.DeleteAsync($"/api/users/{auth.UserId}/roles/InvalidRole123");

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Admin_cannot_remove_own_admin_role()
    {
        await db.ResetAsync();
        var (client, auth, _) = await _factory.CreateAuthenticatedClientAsync();

        // Try to remove own Admin role
        var resp = await client.DeleteAsync($"/api/users/{auth.UserId}/roles/Admin");

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var json = await resp.Content.ReadAsStringAsync();
        Assert.Contains("cannot remove your own Admin role", json);
    }
}
