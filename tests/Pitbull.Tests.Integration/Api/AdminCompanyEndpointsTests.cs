using System.Net;
using System.Net.Http.Json;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class AdminCompanyEndpointsTests(PostgresFixture db) : IAsyncLifetime
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
    public async Task Get_company_settings_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/admin/company");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Get_company_settings_returns_defaults_for_new_tenant()
    {
        await db.ResetAsync();

        // First user is auto-promoted to Admin
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync("/api/admin/company");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        // Should return default settings
        Assert.Contains("\"companyName\":", json);
        Assert.Contains("\"timezone\":", json);
        Assert.Contains("\"dateFormat\":", json);
        Assert.Contains("\"currency\":", json);
    }

    [Fact]
    public async Task Update_company_settings_persists_changes()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var updateRequest = new
        {
            companyName = "Pitbull Construction Test Co",
            logoUrl = "https://example.com/logo.png",
            primaryColor = "#FF5500",
            address = "123 Main Street",
            city = "Los Angeles",
            state = "CA",
            zipCode = "90001",
            phone = "555-123-4567",
            website = "https://pitbullconstruction.com",
            taxId = "12-3456789",
            timezone = "America/New_York",
            dateFormat = "dd/MM/yyyy",
            currency = "USD",
            fiscalYearStartMonth = 7
        };

        var updateResp = await client.PutAsJsonAsync("/api/admin/company", updateRequest);
        Assert.Equal(HttpStatusCode.OK, updateResp.StatusCode);

        var updated = await updateResp.Content.ReadAsStringAsync();
        Assert.Contains("\"companyName\":\"Pitbull Construction Test Co\"", updated);
        Assert.Contains("\"city\":\"Los Angeles\"", updated);
        Assert.Contains("\"state\":\"CA\"", updated);
        Assert.Contains("\"timezone\":\"America/New_York\"", updated);
        Assert.Contains("\"fiscalYearStartMonth\":7", updated);
    }

    [Fact]
    public async Task Update_company_settings_with_minimal_data_succeeds()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var minimalRequest = new
        {
            companyName = "Minimal Co"
        };

        var resp = await client.PutAsJsonAsync("/api/admin/company", minimalRequest);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        Assert.Contains("\"companyName\":\"Minimal Co\"", json);
        // Should still have default timezone
        Assert.Contains("\"timezone\":", json);
    }

    [Fact]
    public async Task Get_company_settings_returns_previously_saved_settings()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // First, update settings
        var updateRequest = new
        {
            companyName = "Persisted Test Company",
            city = "San Francisco"
        };

        var updateResp = await client.PutAsJsonAsync("/api/admin/company", updateRequest);
        Assert.Equal(HttpStatusCode.OK, updateResp.StatusCode);

        // Then retrieve and verify
        var getResp = await client.GetAsync("/api/admin/company");
        Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);

        var json = await getResp.Content.ReadAsStringAsync();
        Assert.Contains("\"companyName\":\"Persisted Test Company\"", json);
        Assert.Contains("\"city\":\"San Francisco\"", json);
    }
}
