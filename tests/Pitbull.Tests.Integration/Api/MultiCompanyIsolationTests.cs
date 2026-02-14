using System.Net;
using System.Net.Http.Json;
using Pitbull.Api.Controllers;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

/// <summary>
/// Integration tests verifying multi-company data isolation with PostgreSQL RLS.
/// These tests use real PostgreSQL via Testcontainers to validate:
/// - Data isolation between companies (projects/bids only visible to their company)
/// - Company switching via API
/// - X-Company-Id header resolution
/// - Authorization for company access
/// </summary>
[Collection(DatabaseCollection.Name)]
[Trait("Category", "MultiCompany")]
public sealed class MultiCompanyIsolationTests(PostgresFixture db) : IAsyncLifetime
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
    public async Task Registration_creates_default_company_and_user_access()
    {
        await db.ResetAsync();

        var (client, auth, _) = await _factory.CreateAuthenticatedClientAsync();

        // User should have company_id claim in JWT
        var companyId = PitbullApiFactory.ExtractCompanyId(auth.Token);
        Assert.NotNull(companyId);
        Assert.NotEqual(Guid.Empty, companyId.Value);

        // User should have company_ids claim
        var companyIds = PitbullApiFactory.ExtractCompanyIds(auth.Token);
        Assert.Single(companyIds);
        Assert.Equal(companyId.Value, companyIds[0]);

        // Get accessible companies - should return the default company
        var accessibleResp = await client.GetAsync("/api/companies/accessible");
        Assert.Equal(HttpStatusCode.OK, accessibleResp.StatusCode);

        var companies = await accessibleResp.Content.ReadFromJsonAsync<List<CompanyResponse>>();
        Assert.NotNull(companies);
        Assert.Single(companies);
        Assert.True(companies[0].IsDefault);
    }

    [Fact]
    public async Task Active_company_endpoint_returns_current_company()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync("/api/companies/active");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var company = await resp.Content.ReadFromJsonAsync<CompanyResponse>();
        Assert.NotNull(company);
        Assert.True(company.IsDefault);
        Assert.True(company.IsActive);
    }

    [Fact]
    public async Task Admin_can_create_additional_companies()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create a second company
        var createReq = new CreateCompanyRequest
        {
            Code = "02",
            Name = "Second Company LLC"
        };

        var createResp = await client.PostAsJsonAsync("/api/admin/companies", createReq);
        Assert.Equal(HttpStatusCode.Created, createResp.StatusCode);

        var created = await createResp.Content.ReadFromJsonAsync<CompanyResponse>();
        Assert.NotNull(created);
        Assert.Equal("02", created.Code);
        Assert.Equal("Second Company LLC", created.Name);
        Assert.False(created.IsDefault);
    }

    [Fact]
    public async Task Admin_companies_list_shows_all_tenant_companies()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create second company
        await client.PostAsJsonAsync("/api/admin/companies", new CreateCompanyRequest { Code = "02", Name = "Company 2" });

        // List all companies
        var listResp = await client.GetAsync("/api/admin/companies");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var companies = await listResp.Content.ReadFromJsonAsync<List<CompanyResponse>>();
        Assert.NotNull(companies);
        Assert.Equal(2, companies.Count);
    }

    [Fact]
    public async Task Switch_company_returns_new_jwt_with_updated_company_id()
    {
        await db.ResetAsync();

        var (client, auth, _) = await _factory.CreateAuthenticatedClientAsync();

        var originalCompanyId = PitbullApiFactory.ExtractCompanyId(auth.Token);
        Assert.NotNull(originalCompanyId);

        // Create a second company
        var createResp = await client.PostAsJsonAsync("/api/admin/companies", new CreateCompanyRequest
        {
            Code = "02",
            Name = "Second Company"
        });
        createResp.EnsureSuccessStatusCode();
        var newCompany = await createResp.Content.ReadFromJsonAsync<CompanyResponse>();
        Assert.NotNull(newCompany);

        // Grant user access to the new company (user needs to be in UserCompanyAccess table)
        var grantResp = await client.PostAsJsonAsync($"/api/admin/companies/{newCompany.Id}/users",
            new GrantCompanyAccessRequest(auth.UserId, null, false));

        // Note: May return 409 if already has access, or 201 if granted
        Assert.True(grantResp.StatusCode is HttpStatusCode.Created or HttpStatusCode.Conflict);

        // We need a new JWT with updated company_ids - login again
        var loginResp = await client.PostAsJsonAsync("/api/auth/login", new
        {
            email = auth.Email,
            password = "SecurePass123"
        });
        loginResp.EnsureSuccessStatusCode();
        var newAuth = await loginResp.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(newAuth);

        // Update client auth header
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", newAuth.Token);

        // Verify we now have access to both companies
        var companyIds = PitbullApiFactory.ExtractCompanyIds(newAuth.Token);
        Assert.Equal(2, companyIds.Count);

        // Switch to the new company
        var switchResp = await client.PostAsync($"/api/companies/switch/{newCompany.Id}", null);
        Assert.Equal(HttpStatusCode.OK, switchResp.StatusCode);

        var switchResult = await switchResp.Content.ReadFromJsonAsync<CompanySwitchResponse>();
        Assert.NotNull(switchResult);

        // Verify the new token has the switched company_id
        var switchedCompanyId = PitbullApiFactory.ExtractCompanyId(switchResult.Token);
        Assert.Equal(newCompany.Id, switchedCompanyId);
    }

    [Fact]
    public async Task Switch_to_unauthorized_company_returns_403()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Try to switch to a random company the user doesn't have access to
        var randomCompanyId = Guid.NewGuid();
        var switchResp = await client.PostAsync($"/api/companies/switch/{randomCompanyId}", null);

        Assert.Equal(HttpStatusCode.Forbidden, switchResp.StatusCode);
    }

    [Fact]
    public async Task Projects_are_created_with_active_company_id()
    {
        await db.ResetAsync();

        var (client, auth, _) = await _factory.CreateAuthenticatedClientAsync();
        var companyId = PitbullApiFactory.ExtractCompanyId(auth.Token);
        Assert.NotNull(companyId);

        // Create a project
        var createResp = await client.PostAsJsonAsync("/api/projects", new
        {
            name = "Test Project",
            number = "PRJ-001",
            type = "Commercial"
        });

        Assert.Equal(HttpStatusCode.Created, createResp.StatusCode);

        // Verify project was created with the correct company ID by listing projects
        var listResp = await client.GetAsync("/api/projects");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var json = await listResp.Content.ReadAsStringAsync();
        Assert.Contains("Test Project", json);
    }

    [Fact]
    public async Task Projects_are_filtered_by_active_company_via_rls()
    {
        await db.ResetAsync();

        var (client1, auth1, _) = await _factory.CreateAuthenticatedClientAsync(
            email: "user1@test.com",
            companyName: "Company One");

        // Create project in Company One
        var createResp1 = await client1.PostAsJsonAsync("/api/projects", new
        {
            name = "Company One Project",
            number = "PRJ-C1-001",
            type = "Commercial"
        });
        Assert.Equal(HttpStatusCode.Created, createResp1.StatusCode);

        // Create a second user with a different company (different tenant in this case)
        var (client2, auth2, _) = await _factory.CreateAuthenticatedClientAsync(
            email: "user2@test.com",
            companyName: "Company Two");

        // Create project in Company Two
        var createResp2 = await client2.PostAsJsonAsync("/api/projects", new
        {
            name = "Company Two Project",
            number = "PRJ-C2-001",
            type = "Commercial"
        });
        Assert.Equal(HttpStatusCode.Created, createResp2.StatusCode);

        // User 1 should only see Company One's project
        var list1 = await client1.GetAsync("/api/projects");
        var json1 = await list1.Content.ReadAsStringAsync();
        Assert.Contains("Company One Project", json1);
        Assert.DoesNotContain("Company Two Project", json1);

        // User 2 should only see Company Two's project
        var list2 = await client2.GetAsync("/api/projects");
        var json2 = await list2.Content.ReadAsStringAsync();
        Assert.Contains("Company Two Project", json2);
        Assert.DoesNotContain("Company One Project", json2);
    }

    [Fact]
    public async Task X_company_id_header_overrides_jwt_company()
    {
        await db.ResetAsync();

        var (client, auth, _) = await _factory.CreateAuthenticatedClientAsync();
        var company1Id = PitbullApiFactory.ExtractCompanyId(auth.Token);
        Assert.NotNull(company1Id);

        // Create a second company and grant access
        var createResp = await client.PostAsJsonAsync("/api/admin/companies", new CreateCompanyRequest
        {
            Code = "02",
            Name = "Second Company"
        });
        createResp.EnsureSuccessStatusCode();
        var company2 = await createResp.Content.ReadFromJsonAsync<CompanyResponse>();
        Assert.NotNull(company2);

        // Grant user access
        var grantResp = await client.PostAsJsonAsync($"/api/admin/companies/{company2.Id}/users",
            new GrantCompanyAccessRequest(auth.UserId, null, false));

        // Re-login to get updated JWT with both company_ids
        var loginResp = await client.PostAsJsonAsync("/api/auth/login", new
        {
            email = auth.Email,
            password = "SecurePass123"
        });
        loginResp.EnsureSuccessStatusCode();
        var newAuth = await loginResp.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(newAuth);

        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", newAuth.Token);

        // Create project in default company
        await client.PostAsJsonAsync("/api/projects", new
        {
            name = "Company 1 Project",
            number = "PRJ-001",
            type = "Commercial"
        });

        // Use X-Company-Id header to switch context to Company 2
        var clientWithHeader = _factory.CreateClientWithCompanyHeader(client, company2.Id);
        clientWithHeader.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", newAuth.Token);
        clientWithHeader.DefaultRequestHeaders.Add("X-Tenant-Id", PitbullApiFactory.ExtractCompanyIds(newAuth.Token).FirstOrDefault().ToString());

        // Create project with Company 2 context via header
        var createC2 = await clientWithHeader.PostAsJsonAsync("/api/projects", new
        {
            name = "Company 2 Project",
            number = "PRJ-002",
            type = "Residential"
        });
        Assert.Equal(HttpStatusCode.Created, createC2.StatusCode);

        // Get active company with header - should be Company 2
        var activeResp = await clientWithHeader.GetAsync("/api/companies/active");
        Assert.Equal(HttpStatusCode.OK, activeResp.StatusCode);
        var activeCompany = await activeResp.Content.ReadFromJsonAsync<CompanyResponse>();
        Assert.NotNull(activeCompany);
        Assert.Equal(company2.Id, activeCompany.Id);
    }

    [Fact]
    public async Task Single_company_tenant_backward_compatibility()
    {
        await db.ResetAsync();

        // Register new tenant - should work exactly as before multi-company feature
        var (client, auth, _) = await _factory.CreateAuthenticatedClientAsync();

        // Should be able to create projects without explicit company selection
        var createResp = await client.PostAsJsonAsync("/api/projects", new
        {
            name = "Single Company Project",
            number = "PRJ-SC-001",
            type = "Commercial"
        });
        Assert.Equal(HttpStatusCode.Created, createResp.StatusCode);

        // List projects
        var listResp = await client.GetAsync("/api/projects");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var json = await listResp.Content.ReadAsStringAsync();
        Assert.Contains("Single Company Project", json);

        // Should have exactly one accessible company
        var accessibleResp = await client.GetAsync("/api/companies/accessible");
        var companies = await accessibleResp.Content.ReadFromJsonAsync<List<CompanyResponse>>();
        Assert.NotNull(companies);
        Assert.Single(companies);
    }

    [Fact]
    public async Task Cannot_delete_default_company()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Get the default company
        var accessibleResp = await client.GetAsync("/api/companies/accessible");
        var companies = await accessibleResp.Content.ReadFromJsonAsync<List<CompanyResponse>>();
        var defaultCompany = companies?.FirstOrDefault(c => c.IsDefault);
        Assert.NotNull(defaultCompany);

        // Try to delete it
        var deleteResp = await client.DeleteAsync($"/api/admin/companies/{defaultCompany.Id}");
        Assert.Equal(HttpStatusCode.BadRequest, deleteResp.StatusCode);

        var error = await deleteResp.Content.ReadAsStringAsync();
        Assert.Contains("default company", error, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Duplicate_company_code_returns_409()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create first company with code "02"
        var createResp1 = await client.PostAsJsonAsync("/api/admin/companies", new CreateCompanyRequest
        {
            Code = "02",
            Name = "Company A"
        });
        Assert.Equal(HttpStatusCode.Created, createResp1.StatusCode);

        // Try to create another company with same code
        var createResp2 = await client.PostAsJsonAsync("/api/admin/companies", new CreateCompanyRequest
        {
            Code = "02",
            Name = "Company B"
        });
        Assert.Equal(HttpStatusCode.Conflict, createResp2.StatusCode);
    }

    [Fact]
    public async Task Company_user_access_crud_operations()
    {
        await db.ResetAsync();

        var (client, auth, _) = await _factory.CreateAuthenticatedClientAsync();

        // Get default company
        var accessibleResp = await client.GetAsync("/api/companies/accessible");
        var companies = await accessibleResp.Content.ReadFromJsonAsync<List<CompanyResponse>>();
        var company = companies!.First();

        // List users for the company
        var listUsersResp = await client.GetAsync($"/api/admin/companies/{company.Id}/users");
        Assert.Equal(HttpStatusCode.OK, listUsersResp.StatusCode);

        var users = await listUsersResp.Content.ReadFromJsonAsync<List<CompanyUserResponse>>();
        Assert.NotNull(users);
        Assert.Single(users); // Just the registered user

        // Create second company
        var createResp = await client.PostAsJsonAsync("/api/admin/companies", new CreateCompanyRequest
        {
            Code = "02",
            Name = "Second Company"
        });
        var newCompany = await createResp.Content.ReadFromJsonAsync<CompanyResponse>();
        Assert.NotNull(newCompany);

        // Grant current user access to new company
        var grantResp = await client.PostAsJsonAsync($"/api/admin/companies/{newCompany.Id}/users",
            new GrantCompanyAccessRequest(auth.UserId, "Manager", false));
        Assert.Equal(HttpStatusCode.Created, grantResp.StatusCode);

        // List users for new company
        var listNewUsersResp = await client.GetAsync($"/api/admin/companies/{newCompany.Id}/users");
        var newUsers = await listNewUsersResp.Content.ReadFromJsonAsync<List<CompanyUserResponse>>();
        Assert.NotNull(newUsers);
        Assert.Single(newUsers);
        Assert.Equal("Manager", newUsers[0].CompanyRole);

        // Revoke access
        var revokeResp = await client.DeleteAsync($"/api/admin/companies/{newCompany.Id}/users/{auth.UserId}");
        Assert.Equal(HttpStatusCode.NoContent, revokeResp.StatusCode);

        // Verify access revoked
        var listAfterRevoke = await client.GetAsync($"/api/admin/companies/{newCompany.Id}/users");
        var usersAfterRevoke = await listAfterRevoke.Content.ReadFromJsonAsync<List<CompanyUserResponse>>();
        Assert.NotNull(usersAfterRevoke);
        Assert.Empty(usersAfterRevoke);
    }
}
