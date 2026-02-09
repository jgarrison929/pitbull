using System.Net;
using System.Net.Http.Json;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;
using Pitbull.Projects.Features.UpdateProject;
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

    [Fact]
    public async Task Can_update_project()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create project
        var create = new CreateProjectCommand(
            Name: "Original Name",
            Number: $"PRJ-UPD-{Guid.NewGuid():N}",
            Description: "Original description",
            Type: ProjectType.Commercial,
            Address: "123 Original St", City: "Test City", State: "CA", ZipCode: "90210",
            ClientName: "Original Client", ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: DateTime.UtcNow, EstimatedCompletionDate: DateTime.UtcNow.AddMonths(6),
            ContractAmount: 100_000m,
            ProjectManagerId: null, SuperintendentId: null, SourceBidId: null);

        var createResp = await client.PostAsJsonAsync("/api/projects", create);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<ProjectDto>())!;

        // Update project
        var update = new UpdateProjectCommand(
            Id: created.Id,
            Name: "Updated Name",
            Number: created.Number,
            Description: "Updated description",
            Type: ProjectType.Industrial,
            Status: ProjectStatus.PreConstruction,
            Address: "456 Updated Ave", City: "New City", State: "TX", ZipCode: "75001",
            ClientName: "Updated Client", ClientContact: "John Doe", ClientEmail: "john@test.com", ClientPhone: "555-1234",
            StartDate: DateTime.UtcNow, EstimatedCompletionDate: DateTime.UtcNow.AddMonths(12),
            ActualCompletionDate: null,
            ContractAmount: 150_000m,
            ProjectManagerId: null, SuperintendentId: null);

        var updateResp = await client.PutAsJsonAsync($"/api/projects/{created.Id}", update);
        if (updateResp.StatusCode != HttpStatusCode.OK)
        {
            var body = await updateResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 200 OK but got {(int)updateResp.StatusCode}. Body: {body}");
        }

        var updated = (await updateResp.Content.ReadFromJsonAsync<ProjectDto>())!;
        Assert.Equal("Updated Name", updated.Name);
        Assert.Equal("Updated description", updated.Description);
        Assert.Equal(ProjectType.Industrial, updated.Type);
        Assert.Equal(ProjectStatus.PreConstruction, updated.Status);
        Assert.Equal(150_000m, updated.ContractAmount);
    }

    [Fact]
    public async Task Can_delete_project()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create project
        var create = new CreateProjectCommand(
            Name: "To Be Deleted",
            Number: $"PRJ-DEL-{Guid.NewGuid():N}",
            Description: "Will be deleted",
            Type: ProjectType.Residential,
            Address: null, City: null, State: null, ZipCode: null,
            ClientName: null, ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: null, EstimatedCompletionDate: null,
            ContractAmount: 50_000m,
            ProjectManagerId: null, SuperintendentId: null, SourceBidId: null);

        var createResp = await client.PostAsJsonAsync("/api/projects", create);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<ProjectDto>())!;

        // Delete
        var deleteResp = await client.DeleteAsync($"/api/projects/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

        // Verify deleted (soft delete - should return 404)
        var getResp = await client.GetAsync($"/api/projects/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task Can_filter_projects_by_type()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create commercial project
        var commercial = new CreateProjectCommand(
            Name: "Commercial Project",
            Number: $"PRJ-COM-{Guid.NewGuid():N}",
            Description: null,
            Type: ProjectType.Commercial,
            Address: null, City: null, State: null, ZipCode: null,
            ClientName: null, ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: null, EstimatedCompletionDate: null,
            ContractAmount: 100_000m,
            ProjectManagerId: null, SuperintendentId: null, SourceBidId: null);

        // Create residential project
        var residential = new CreateProjectCommand(
            Name: "Residential Project",
            Number: $"PRJ-RES-{Guid.NewGuid():N}",
            Description: null,
            Type: ProjectType.Residential,
            Address: null, City: null, State: null, ZipCode: null,
            ClientName: null, ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: null, EstimatedCompletionDate: null,
            ContractAmount: 200_000m,
            ProjectManagerId: null, SuperintendentId: null, SourceBidId: null);

        await client.PostAsJsonAsync("/api/projects", commercial);
        await client.PostAsJsonAsync("/api/projects", residential);

        // Filter by Commercial type
        var commercialResp = await client.GetAsync($"/api/projects?type={(int)ProjectType.Commercial}");
        commercialResp.EnsureSuccessStatusCode();
        var commercialJson = await commercialResp.Content.ReadAsStringAsync();
        Assert.Contains("Commercial Project", commercialJson);
        Assert.DoesNotContain("Residential Project", commercialJson);

        // Filter by Residential type
        var residentialResp = await client.GetAsync($"/api/projects?type={(int)ProjectType.Residential}");
        residentialResp.EnsureSuccessStatusCode();
        var residentialJson = await residentialResp.Content.ReadAsStringAsync();
        Assert.Contains("Residential Project", residentialJson);
        Assert.DoesNotContain("Commercial Project", residentialJson);
    }

    [Fact]
    public async Task Can_search_projects_by_name()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create projects with different names
        var alpha = new CreateProjectCommand(
            Name: "Alpha Construction",
            Number: $"PRJ-A-{Guid.NewGuid():N}",
            Description: null, Type: ProjectType.Commercial,
            Address: null, City: null, State: null, ZipCode: null,
            ClientName: null, ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: null, EstimatedCompletionDate: null, ContractAmount: 100_000m,
            ProjectManagerId: null, SuperintendentId: null, SourceBidId: null);

        var beta = new CreateProjectCommand(
            Name: "Beta Builders",
            Number: $"PRJ-B-{Guid.NewGuid():N}",
            Description: null, Type: ProjectType.Residential,
            Address: null, City: null, State: null, ZipCode: null,
            ClientName: null, ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: null, EstimatedCompletionDate: null, ContractAmount: 200_000m,
            ProjectManagerId: null, SuperintendentId: null, SourceBidId: null);

        await client.PostAsJsonAsync("/api/projects", alpha);
        await client.PostAsJsonAsync("/api/projects", beta);

        // Search for "Alpha"
        var searchResp = await client.GetAsync("/api/projects?search=Alpha");
        searchResp.EnsureSuccessStatusCode();
        var searchJson = await searchResp.Content.ReadAsStringAsync();
        Assert.Contains("Alpha Construction", searchJson);
        Assert.DoesNotContain("Beta Builders", searchJson);
    }

    [Fact]
    public async Task Stats_for_nonexistent_project_returns_404()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Get stats for non-existent project
        var statsResp = await client.GetAsync($"/api/projects/{Guid.NewGuid()}/stats");
        Assert.Equal(HttpStatusCode.NotFound, statsResp.StatusCode);
    }

    [Fact]
    public async Task Cannot_update_nonexistent_project()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var fakeId = Guid.NewGuid();
        var update = new UpdateProjectCommand(
            Id: fakeId,
            Name: "Fake Project", Number: "PRJ-FAKE", Description: null,
            Type: ProjectType.Commercial, Status: ProjectStatus.Active,
            Address: null, City: null, State: null, ZipCode: null,
            ClientName: null, ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: null, EstimatedCompletionDate: null, ActualCompletionDate: null,
            ContractAmount: 1000m,
            ProjectManagerId: null, SuperintendentId: null);

        var updateResp = await client.PutAsJsonAsync($"/api/projects/{fakeId}", update);
        Assert.Equal(HttpStatusCode.NotFound, updateResp.StatusCode);
    }

    [Fact]
    public async Task Cannot_delete_nonexistent_project()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var deleteResp = await client.DeleteAsync($"/api/projects/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, deleteResp.StatusCode);
    }
}
