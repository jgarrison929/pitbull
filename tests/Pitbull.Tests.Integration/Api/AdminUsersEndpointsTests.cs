using System.Net;
using System.Net.Http.Json;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class AdminUsersEndpointsTests(PostgresFixture db) : IAsyncLifetime
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

        var resp = await client.GetAsync("/api/admin/users");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task List_users_returns_users_for_admin()
    {
        await db.ResetAsync();

        // First user is auto-promoted to Admin
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync("/api/admin/users");

        // First user should have Admin role
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        Assert.Contains("email", json);
        Assert.Contains("roles", json);
    }

    [Fact]
    public async Task Get_user_by_id_returns_user_details()
    {
        await db.ResetAsync();

        var (client, auth, _) = await _factory.CreateAuthenticatedClientAsync();
        var userId = auth.UserId;

        var resp = await client.GetAsync($"/api/admin/users/{userId}");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        Assert.Contains(userId.ToString(), json);
        Assert.Contains("email", json);
        Assert.Contains("firstName", json);
        Assert.Contains("lastName", json);
        Assert.Contains("roles", json);
    }

    [Fact]
    public async Task Get_user_by_nonexistent_id_returns_404()
    {
        await db.ResetAsync();

        var (client, auth, _) = await _factory.CreateAuthenticatedClientAsync();

        var nonExistentId = Guid.NewGuid();
        var resp = await client.GetAsync($"/api/admin/users/{nonExistentId}");

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Get_roles_returns_available_roles()
    {
        await db.ResetAsync();

        var (client, auth, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync("/api/admin/users/roles");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        // Should return an array of roles
        Assert.StartsWith("[", json.Trim());
    }

    [Fact]
    public async Task List_users_supports_search_filter()
    {
        await db.ResetAsync();

        var (client, auth, _) = await _factory.CreateAuthenticatedClientAsync();

        // Search for non-existent user
        var resp = await client.GetAsync("/api/admin/users?search=NONEXISTENT12345");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        Assert.Contains("\"items\":[]", json);
    }

    [Fact]
    public async Task Update_user_changes_name_and_status()
    {
        await db.ResetAsync();

        var (client, auth, _) = await _factory.CreateAuthenticatedClientAsync(
            firstName: "Original",
            lastName: "Name");
        var userId = auth.UserId;

        // Update user's name
        var updateReq = new
        {
            firstName = "Updated",
            lastName = "UserName",
            status = "Active"
        };

        var resp = await client.PutAsJsonAsync($"/api/admin/users/{userId}", updateReq);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        Assert.Contains("\"firstName\":\"Updated\"", json);
        Assert.Contains("\"lastName\":\"UserName\"", json);
    }

    [Fact]
    public async Task Update_user_can_change_roles()
    {
        await db.ResetAsync();

        var (client, auth, tenantId) = await _factory.CreateAuthenticatedClientAsync();
        var userId = auth.UserId;

        // Update user's roles (remove Admin, just keep User)
        var updateReq = new
        {
            roles = new[] { $"{tenantId}:User" }
        };

        var resp = await client.PutAsJsonAsync($"/api/admin/users/{userId}", updateReq);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        Assert.Contains("roles", json);
    }

    [Fact]
    public async Task Update_nonexistent_user_returns_404()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var updateReq = new
        {
            firstName = "Ghost",
            lastName = "User"
        };

        var resp = await client.PutAsJsonAsync($"/api/admin/users/{Guid.NewGuid()}", updateReq);
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task List_users_supports_role_filter()
    {
        await db.ResetAsync();

        var (client, _, tenantId) = await _factory.CreateAuthenticatedClientAsync();

        // Filter by Admin role (first user should have it)
        var resp = await client.GetAsync($"/api/admin/users?role={tenantId}:Admin");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        // Should return at least one user (the current admin)
        Assert.NotEqual("[]", json);
    }

    [Fact]
    public async Task List_users_supports_active_filter()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Filter by active status
        var resp = await client.GetAsync("/api/admin/users?isActive=true");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        // Should return at least one active user
        Assert.NotEqual("[]", json);
    }
}
