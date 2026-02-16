using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Pitbull.Api.Controllers;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class CompaniesEndpointsTests(PostgresFixture db) : IAsyncLifetime
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

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

    #region Authentication Tests

    [Fact]
    public async Task Get_active_company_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/companies/active");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Get_accessible_companies_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/companies/accessible");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Switch_company_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.PostAsJsonAsync($"/api/companies/switch/{Guid.NewGuid()}", new { });

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    #endregion

    #region Active Company Tests

    [Fact]
    public async Task Get_active_company_returns_200()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync("/api/companies/active");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var company = await resp.Content.ReadFromJsonAsync<CompanyResponse>(JsonOptions);
        Assert.NotNull(company);
        Assert.NotEqual(Guid.Empty, company!.Id);
        Assert.True(company.IsActive);
    }

    #endregion

    #region Accessible Companies Tests

    [Fact]
    public async Task Get_accessible_companies_returns_200_with_at_least_one()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync("/api/companies/accessible");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var companies = await resp.Content.ReadFromJsonAsync<List<CompanyResponse>>(JsonOptions);
        Assert.NotNull(companies);
        Assert.NotEmpty(companies!);
        Assert.All(companies, c => Assert.True(c.IsActive));
    }

    #endregion

    #region Switch Company Tests

    [Fact]
    public async Task Switch_company_returns_new_jwt()
    {
        await db.ResetAsync();
        var (client, auth, _) = await _factory.CreateAuthenticatedClientAsync();

        // Get the user's accessible companies
        var accessibleResp = await client.GetAsync("/api/companies/accessible");
        accessibleResp.EnsureSuccessStatusCode();
        var companies = await accessibleResp.Content.ReadFromJsonAsync<List<CompanyResponse>>(JsonOptions);
        Assert.NotNull(companies);
        Assert.NotEmpty(companies!);

        // Switch to the first accessible company (should be the same one since there's only one)
        var targetCompany = companies!.First();
        var switchResp = await client.PostAsync($"/api/companies/switch/{targetCompany.Id}", null);

        Assert.Equal(HttpStatusCode.OK, switchResp.StatusCode);

        var switchResult = await switchResp.Content.ReadFromJsonAsync<CompanySwitchResponse>(JsonOptions);
        Assert.NotNull(switchResult);
        Assert.NotNull(switchResult!.Token);
        Assert.NotNull(switchResult.Company);
        Assert.Equal(targetCompany.Id, switchResult.Company.Id);

        // Verify the new token contains the company_id claim
        var newCompanyId = PitbullApiFactory.ExtractCompanyId(switchResult.Token);
        Assert.NotNull(newCompanyId);
        Assert.Equal(targetCompany.Id, newCompanyId!.Value);
    }

    [Fact]
    public async Task Switch_to_nonexistent_company_returns_403()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.PostAsync($"/api/companies/switch/{Guid.NewGuid()}", null);

        // User doesn't have access to a random company, so 403
        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    #endregion
}
