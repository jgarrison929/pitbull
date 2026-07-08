using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using Npgsql;
using Xunit.Abstractions;
using Pitbull.Api.Controllers;
using Pitbull.Api.Infrastructure;
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

        var tenantId = Guid.Parse(jwt.Claims.First(c => c.Type == "tenant_id").Value);
        var roleCount = await CountTenantRolesAsync(tenantId);
        output.WriteLine($"OWNER_SIGNUP roleCount={roleCount}");
        Assert.Equal(RoleSeeder.Roles.All.Length, roleCount);
    }

    [Fact]
    public async Task OwnerRegister_CamelCaseWizardJsonBody_Succeeds()
    {
        await db.ResetAsync();
        var email = $"camel-{Guid.NewGuid():N}@example.com";

        using var client = _factory.CreateClient();
        var wizardBody = new
        {
            firstName = "  Test  ",
            lastName = "Owner",
            email,
            password = "SecurePass123",
            companyName = "Acme 123 Construction LLC",
            industryType = "general-contractor",
            employeeRange = "11-50",
        };

        var registerResp = await client.PostAsJsonAsync("/api/auth/register", wizardBody);
        var body = await registerResp.Content.ReadAsStringAsync();
        output.WriteLine($"OWNER_CAMEL register status={(int)registerResp.StatusCode} body={body}");

        Assert.Equal(HttpStatusCode.Created, registerResp.StatusCode);
        var auth = await registerResp.Content.ReadFromJsonAsync<AuthResponse>(TestJsonOptions.Default);
        Assert.NotNull(auth);
        Assert.Contains("Admin", auth!.Roles);
    }

    [Fact]
    public async Task OwnerRegister_WizardEquivalentPayload_Succeeds()
    {
        await db.ResetAsync();
        var email = $"wizard-{Guid.NewGuid():N}@example.com";

        using var client = _factory.CreateClient();
        var registerResp = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(
            Email: email,
            Password: "SecurePass123",
            FirstName: "Wizard",
            LastName: "Owner",
            TenantId: default,
            CompanyName: "Wizard Construction LLC",
            IndustryType: "general-contractor",
            EmployeeRange: "11-50"));

        var body = await registerResp.Content.ReadAsStringAsync();
        output.WriteLine($"OWNER_WIZARD register status={(int)registerResp.StatusCode} body={body}");

        registerResp.EnsureSuccessStatusCode();
        var auth = await registerResp.Content.ReadFromJsonAsync<AuthResponse>(TestJsonOptions.Default);
        Assert.NotNull(auth);
        Assert.Contains("Admin", auth!.Roles);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.Token);
        var setupResp = await client.GetAsync("/api/users/me");
        setupResp.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task OwnerRegister_OnboardingIncompleteUntilWizardStepsMarked()
    {
        await db.ResetAsync();
        var email = $"onboard-{Guid.NewGuid():N}@example.com";

        using var client = _factory.CreateClient();
        var registerResp = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(
            Email: email,
            Password: "SecurePass123",
            FirstName: "Onboard",
            LastName: "Owner",
            TenantId: default,
            CompanyName: "Onboard Construction LLC"));

        registerResp.EnsureSuccessStatusCode();
        var auth = (await registerResp.Content.ReadFromJsonAsync<AuthResponse>(TestJsonOptions.Default))!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.Token);

        var statusResp = await client.GetAsync("/api/onboarding/status");
        var statusBody = await statusResp.Content.ReadAsStringAsync();
        output.WriteLine($"OWNER_ONBOARD status_before={(int)statusResp.StatusCode} body={statusBody}");
        statusResp.EnsureSuccessStatusCode();

        using var statusDoc = System.Text.Json.JsonDocument.Parse(statusBody);
        Assert.False(statusDoc.RootElement.GetProperty("isSetupComplete").GetBoolean());

        foreach (var item in new[] { "company_profile", "contractor_type", "modules_activated", "modules_configured" })
        {
            var putResp = await client.PutAsJsonAsync(
                $"/api/onboarding/checklist/{item}",
                new { completed = true });
            putResp.EnsureSuccessStatusCode();
        }

        statusResp = await client.GetAsync("/api/onboarding/status");
        statusBody = await statusResp.Content.ReadAsStringAsync();
        output.WriteLine($"OWNER_ONBOARD status_after={(int)statusResp.StatusCode} body={statusBody}");
        statusResp.EnsureSuccessStatusCode();

        using var statusAfter = System.Text.Json.JsonDocument.Parse(statusBody);
        Assert.True(statusAfter.RootElement.GetProperty("isSetupComplete").GetBoolean());
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

    private async Task<int> CountTenantRolesAsync(Guid tenantId)
    {
        await using var conn = new NpgsqlConnection(db.AdminConnectionString);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(
            """SELECT COUNT(*)::int FROM roles WHERE "TenantId" = @tenantId""",
            conn);
        cmd.Parameters.AddWithValue("tenantId", tenantId);
        return (int)(await cmd.ExecuteScalarAsync() ?? 0);
    }
}