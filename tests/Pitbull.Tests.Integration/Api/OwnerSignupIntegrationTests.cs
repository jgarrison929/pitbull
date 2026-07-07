using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using Xunit.Abstractions;
using Pitbull.Api.Controllers;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

/// <summary>
/// Owner self-service signup: register creates tenant + Admin, login round-trip, admin API access.
/// </summary>
[Collection(DatabaseCollection.Name)]
public sealed class OwnerSignupIntegrationTests(PostgresFixture db, ITestOutputHelper output) : IAsyncLifetime
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
    public async Task OwnerRegister_CreatesTenantAdminWithCompanyAccess()
    {
        await db.ResetAsync();
        var email = $"owner-{Guid.NewGuid():N}@example.com";
        const string password = "SecurePass123";
        const string companyName = "Owner Signup Co";

        using var client = _factory.CreateClient();
        var registerResp = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(
            Email: email,
            Password: password,
            FirstName: "Owner",
            LastName: "Admin",
            TenantId: default,
            CompanyName: companyName));

        var registerBody = await registerResp.Content.ReadAsStringAsync();
        output.WriteLine($"OWNER_SIGNUP register status={(int)registerResp.StatusCode} body={registerBody}");

        Assert.Equal(HttpStatusCode.Created, registerResp.StatusCode);
        var auth = await registerResp.Content.ReadFromJsonAsync<AuthResponse>(TestJsonOptions.Default);
        Assert.NotNull(auth);
        Assert.Contains("Admin", auth!.Roles);

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(auth.Token);
        Assert.Contains(jwt.Claims, c => c.Type == ClaimTypes.Role && c.Value == "Admin");
        Assert.Contains(jwt.Claims, c => c.Type == "permissions" && c.Value == "*");

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.Token);

        var meResp = await client.GetAsync("/api/users/me");
        var meBody = await meResp.Content.ReadAsStringAsync();
        output.WriteLine($"OWNER_SIGNUP me status={(int)meResp.StatusCode} body={meBody}");
        meResp.EnsureSuccessStatusCode();

        var profile = await meResp.Content.ReadFromJsonAsync<UserProfileResponse>(TestJsonOptions.Default);
        Assert.NotNull(profile);
        Assert.Contains("Admin", profile!.Roles);
        Assert.NotNull(profile.ActiveCompany);
        Assert.Equal(companyName, profile.ActiveCompany!.Name);
        Assert.NotEmpty(profile.AccessibleCompanies);

        var costCodesResp = await client.GetAsync("/api/cost-codes");
        var costCodesBody = await costCodesResp.Content.ReadAsStringAsync();
        output.WriteLine($"OWNER_SIGNUP costCodes status={(int)costCodesResp.StatusCode} body={costCodesBody}");
        costCodesResp.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task OwnerRegister_LoginRoundTrip_AccessesAdminUsers()
    {
        await db.ResetAsync();
        var email = $"owner-login-{Guid.NewGuid():N}@example.com";
        const string password = "SecurePass123";

        using var client = _factory.CreateClient();

        var registerResp = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(
            Email: email,
            Password: password,
            FirstName: "Round",
            LastName: "Trip",
            TenantId: default,
            CompanyName: "Round Trip Construction"));

        registerResp.EnsureSuccessStatusCode();
        var registerAuth = (await registerResp.Content.ReadFromJsonAsync<AuthResponse>(TestJsonOptions.Default))!;

        client.DefaultRequestHeaders.Authorization = null;

        var loginResp = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        var loginBody = await loginResp.Content.ReadAsStringAsync();
        output.WriteLine($"OWNER_LOGIN login status={(int)loginResp.StatusCode} body={loginBody}");

        loginResp.EnsureSuccessStatusCode();
        var loginAuth = await loginResp.Content.ReadFromJsonAsync<AuthResponse>(TestJsonOptions.Default);
        Assert.NotNull(loginAuth);
        Assert.Contains("Admin", loginAuth!.Roles);
        Assert.NotEqual(registerAuth.Token, loginAuth.Token);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginAuth.Token);

        var adminUsersResp = await client.GetAsync("/api/admin/users");
        var adminBody = await adminUsersResp.Content.ReadAsStringAsync();
        output.WriteLine($"OWNER_LOGIN adminUsers status={(int)adminUsersResp.StatusCode} body={adminBody}");

        Assert.Equal(HttpStatusCode.OK, adminUsersResp.StatusCode);
        Assert.Contains(email, adminBody, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task OwnerRegister_BlockedWhenDemoDisablesRegistration()
    {
        await using var demoFactory = new PitbullApiFactory(db.AppConnectionString, new Dictionary<string, string?>
        {
            ["Demo:Enabled"] = "true",
            ["Demo:DisableRegistration"] = "true"
        });
        using var client = demoFactory.CreateClient();

        var resp = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(
            Email: $"blocked-{Guid.NewGuid():N}@example.com",
            Password: "SecurePass123",
            FirstName: "Blocked",
            LastName: "User",
            TenantId: default,
            CompanyName: "Should Fail"));

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }
}