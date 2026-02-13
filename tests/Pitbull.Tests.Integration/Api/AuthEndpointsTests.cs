using System.Net;
using System.Net.Http.Json;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class AuthEndpointsTests(PostgresFixture db) : IAsyncLifetime
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
    public async Task Get_me_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Get_me_returns_user_profile()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();

        // Should contain profile fields
        Assert.Contains("id", json);
        Assert.Contains("email", json);
        Assert.Contains("firstName", json);
        Assert.Contains("lastName", json);
        Assert.Contains("fullName", json);
        Assert.Contains("roles", json);
        Assert.Contains("tenantId", json);
        Assert.Contains("tenantName", json);
    }

    [Fact]
    public async Task Change_password_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.PostAsJsonAsync("/api/auth/change-password", new
        {
            currentPassword = "OldPass123",
            newPassword = "NewPass456"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Change_password_with_wrong_current_returns_400()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.PostAsJsonAsync("/api/auth/change-password", new
        {
            currentPassword = "WrongPassword123",
            newPassword = "NewPass456"
        });

        // Should fail validation due to incorrect current password
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Change_password_with_short_new_returns_400()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.PostAsJsonAsync("/api/auth/change-password", new
        {
            currentPassword = "SecurePass123",
            newPassword = "short"
        });

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        Assert.Contains("8 characters", json);
    }

    [Fact]
    public async Task Register_with_invalid_email_returns_400()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.PostAsJsonAsync("/api/auth/register", new
        {
            email = "not-an-email",
            password = "SecurePass123",
            firstName = "Test",
            lastName = "User"
        });

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Register_creates_new_tenant_when_none_provided()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var email = $"test-{Guid.NewGuid():N}@example.com";
        var resp = await client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password = "SecurePass123",
            firstName = "Test",
            lastName = "User",
            companyName = "Test Company Inc"
        });

        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        Assert.Contains("token", json);
        Assert.Contains("userId", json);
    }

    [Fact]
    public async Task Login_with_invalid_credentials_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.PostAsJsonAsync("/api/auth/login", new
        {
            email = "nonexistent@example.com",
            password = "WrongPassword"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Login_returns_user_roles()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        // Register first
        var email = $"test-{Guid.NewGuid():N}@example.com";
        var registerResp = await client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password = "SecurePass123",
            firstName = "Test",
            lastName = "User"
        });
        registerResp.EnsureSuccessStatusCode();

        // Login
        var loginResp = await client.PostAsJsonAsync("/api/auth/login", new
        {
            email,
            password = "SecurePass123"
        });

        Assert.Equal(HttpStatusCode.OK, loginResp.StatusCode);

        var json = await loginResp.Content.ReadAsStringAsync();
        Assert.Contains("roles", json);
        // First user should be Admin
        Assert.Contains("Admin", json);
    }
}
