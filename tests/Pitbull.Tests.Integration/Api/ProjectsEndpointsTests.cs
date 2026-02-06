using System.Net;
using System.Net.Http.Json;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class ProjectsEndpointsTests(PostgresFixture db) : IAsyncLifetime
{
    private PitbullApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        _factory = new PitbullApiFactory(db.AppConnectionString);

        // Force host start + migrations before any Respawn reset runs.
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
    public async Task Get_projects_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/projects");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Can_create_get_and_list_projects_when_authenticated()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var create = new CreateProjectCommand(
            Name: "Integration Test Project",
            Number: $"PRJ-{Guid.NewGuid():N}",
            Description: "created by integration test",
            Type: ProjectType.Commercial,
            Address: null,
            City: null,
            State: null,
            ZipCode: null,
            ClientName: null,
            ClientContact: null,
            ClientEmail: null,
            ClientPhone: null,
            StartDate: null,
            EstimatedCompletionDate: null,
            ContractAmount: 12345.67m,
            ProjectManagerId: null,
            SuperintendentId: null,
            SourceBidId: null);

        var createResp = await client.PostAsJsonAsync("/api/projects", create);
        if (createResp.StatusCode != HttpStatusCode.Created)
        {
            var body = await createResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 201 Created but got {(int)createResp.StatusCode} {createResp.StatusCode}. Body: {body}");
        }

        var created = (await createResp.Content.ReadFromJsonAsync<ProjectDto>())!;
        Assert.NotEqual(Guid.Empty, created.Id);
        Assert.Equal(create.Name, created.Name);
        Assert.Equal(create.Number, created.Number);

        var getResp = await client.GetAsync($"/api/projects/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);

        var fetched = (await getResp.Content.ReadFromJsonAsync<ProjectDto>())!;
        Assert.Equal(created.Id, fetched.Id);
        Assert.Equal(create.Number, fetched.Number);

        var listResp = await client.GetAsync("/api/projects?page=1&pageSize=25");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains(create.Number, listJson);
    }

    [Fact]
    public async Task Project_from_other_tenant_is_not_visible_returns_404()
    {
        await db.ResetAsync();

        var (clientTenantA, _, _) = await _factory.CreateAuthenticatedClientAsync();
        var (clientTenantB, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var create = new CreateProjectCommand(
            Name: "Tenant A Project",
            Number: $"PRJ-A-{Guid.NewGuid():N}",
            Description: null,
            Type: ProjectType.Infrastructure,
            Address: null,
            City: null,
            State: null,
            ZipCode: null,
            ClientName: null,
            ClientContact: null,
            ClientEmail: null,
            ClientPhone: null,
            StartDate: null,
            EstimatedCompletionDate: null,
            ContractAmount: 1m,
            ProjectManagerId: null,
            SuperintendentId: null,
            SourceBidId: null);

        var createResp = await clientTenantA.PostAsJsonAsync("/api/projects", create);
        createResp.EnsureSuccessStatusCode();

        var created = (await createResp.Content.ReadFromJsonAsync<ProjectDto>())!;

        var getAsOtherTenant = await clientTenantB.GetAsync($"/api/projects/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getAsOtherTenant.StatusCode);
    }
}
