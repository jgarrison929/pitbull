using System.Net;
using System.Net.Http.Json;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreateSubcontract;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class SubcontractsEndpointsTests(PostgresFixture db) : IAsyncLifetime
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
    public async Task Get_subcontracts_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/subcontracts");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Can_create_get_and_list_subcontracts_when_authenticated()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // First create a project (subcontracts require a project)
        var projectCmd = new CreateProjectCommand(
            Name: "Subcontract Test Project",
            Number: $"PRJ-{Guid.NewGuid():N}",
            Description: "project for subcontract testing",
            Type: ProjectType.Commercial,
            Address: "123 Test St",
            City: "Test City",
            State: "CA",
            ZipCode: "90210",
            ClientName: "Test Client",
            ClientContact: null,
            ClientEmail: null,
            ClientPhone: null,
            StartDate: DateTime.UtcNow,
            EstimatedCompletionDate: DateTime.UtcNow.AddMonths(6),
            ContractAmount: 1_000_000m,
            ProjectManagerId: null,
            SuperintendentId: null,
            SourceBidId: null);

        var projectResp = await client.PostAsJsonAsync("/api/projects", projectCmd);
        projectResp.EnsureSuccessStatusCode();
        var project = (await projectResp.Content.ReadFromJsonAsync<ProjectDto>())!;

        // Create a subcontract
        var subcontractCmd = new CreateSubcontractCommand(
            ProjectId: project.Id,
            SubcontractNumber: $"SC-{Guid.NewGuid():N}",
            SubcontractorName: "ABC Concrete Inc",
            SubcontractorContact: "John Smith",
            SubcontractorEmail: "john@abcconcrete.com",
            SubcontractorPhone: "555-123-4567",
            SubcontractorAddress: "456 Industrial Way",
            ScopeOfWork: "Concrete foundations and footings",
            TradeCode: "03 - Concrete",
            OriginalValue: 150_000m,
            RetainagePercent: 10m,
            StartDate: DateTime.UtcNow,
            CompletionDate: DateTime.UtcNow.AddMonths(2),
            LicenseNumber: "CON-12345",
            Notes: "Integration test subcontract");

        var createResp = await client.PostAsJsonAsync("/api/subcontracts", subcontractCmd);
        if (createResp.StatusCode != HttpStatusCode.Created)
        {
            var body = await createResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 201 Created but got {(int)createResp.StatusCode}. Body: {body}");
        }

        var created = (await createResp.Content.ReadFromJsonAsync<SubcontractDto>())!;
        Assert.NotEqual(Guid.Empty, created.Id);
        Assert.Equal(subcontractCmd.SubcontractorName, created.SubcontractorName);
        Assert.Equal(subcontractCmd.SubcontractNumber, created.SubcontractNumber);
        Assert.Equal(subcontractCmd.OriginalValue, created.OriginalValue);
        Assert.Equal(subcontractCmd.OriginalValue, created.CurrentValue); // No change orders yet
        Assert.Equal(SubcontractStatus.Draft, created.Status);

        // Get by ID
        var getResp = await client.GetAsync($"/api/subcontracts/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);

        var fetched = (await getResp.Content.ReadFromJsonAsync<SubcontractDto>())!;
        Assert.Equal(created.Id, fetched.Id);
        Assert.Equal(created.SubcontractNumber, fetched.SubcontractNumber);

        // List
        var listResp = await client.GetAsync("/api/subcontracts?page=1&pageSize=25");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains(subcontractCmd.SubcontractNumber, listJson);
    }

    [Fact]
    public async Task Subcontract_from_other_tenant_is_not_visible()
    {
        await db.ResetAsync();

        var (clientA, _, _) = await _factory.CreateAuthenticatedClientAsync();
        var (clientB, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create project and subcontract as Tenant A
        var projectCmd = new CreateProjectCommand(
            Name: "Tenant A Project",
            Number: $"PRJ-A-{Guid.NewGuid():N}",
            Description: null,
            Type: ProjectType.Infrastructure,
            Address: null, City: null, State: null, ZipCode: null,
            ClientName: null, ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: null, EstimatedCompletionDate: null,
            ContractAmount: 500_000m,
            ProjectManagerId: null, SuperintendentId: null, SourceBidId: null);

        var projectResp = await clientA.PostAsJsonAsync("/api/projects", projectCmd);
        projectResp.EnsureSuccessStatusCode();
        var project = (await projectResp.Content.ReadFromJsonAsync<ProjectDto>())!;

        var subcontractCmd = new CreateSubcontractCommand(
            ProjectId: project.Id,
            SubcontractNumber: $"SC-A-{Guid.NewGuid():N}",
            SubcontractorName: "Tenant A Subcontractor",
            SubcontractorContact: null,
            SubcontractorEmail: null,
            SubcontractorPhone: null,
            SubcontractorAddress: null,
            ScopeOfWork: "Test scope",
            TradeCode: null,
            OriginalValue: 50_000m,
            RetainagePercent: 10m,
            StartDate: null,
            CompletionDate: null,
            LicenseNumber: null,
            Notes: null);

        var createResp = await clientA.PostAsJsonAsync("/api/subcontracts", subcontractCmd);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<SubcontractDto>())!;

        // Tenant B should not see it
        var getAsOtherTenant = await clientB.GetAsync($"/api/subcontracts/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getAsOtherTenant.StatusCode);

        // Tenant B's list should not contain it
        var listResp = await clientB.GetAsync("/api/subcontracts?page=1&pageSize=100");
        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.DoesNotContain(subcontractCmd.SubcontractNumber, listJson);
    }

    [Fact]
    public async Task Duplicate_subcontract_number_returns_400()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create project
        var projectCmd = new CreateProjectCommand(
            Name: "Duplicate Test Project",
            Number: $"PRJ-{Guid.NewGuid():N}",
            Description: null,
            Type: ProjectType.Commercial,
            Address: null, City: null, State: null, ZipCode: null,
            ClientName: null, ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: null, EstimatedCompletionDate: null,
            ContractAmount: 100_000m,
            ProjectManagerId: null, SuperintendentId: null, SourceBidId: null);

        var projectResp = await client.PostAsJsonAsync("/api/projects", projectCmd);
        projectResp.EnsureSuccessStatusCode();
        var project = (await projectResp.Content.ReadFromJsonAsync<ProjectDto>())!;

        var scNumber = $"SC-DUP-{Guid.NewGuid():N}";

        var subcontractCmd = new CreateSubcontractCommand(
            ProjectId: project.Id,
            SubcontractNumber: scNumber,
            SubcontractorName: "First Subcontractor",
            SubcontractorContact: null,
            SubcontractorEmail: null,
            SubcontractorPhone: null,
            SubcontractorAddress: null,
            ScopeOfWork: "First scope",
            TradeCode: null,
            OriginalValue: 25_000m,
            RetainagePercent: 10m,
            StartDate: null,
            CompletionDate: null,
            LicenseNumber: null,
            Notes: null);

        var first = await client.PostAsJsonAsync("/api/subcontracts", subcontractCmd);
        first.EnsureSuccessStatusCode();

        // Try to create another with the same number
        var duplicateCmd = subcontractCmd with { SubcontractorName = "Second Subcontractor" };
        var second = await client.PostAsJsonAsync("/api/subcontracts", duplicateCmd);

        Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
        var body = await second.Content.ReadAsStringAsync();
        Assert.Contains("already exists", body, StringComparison.OrdinalIgnoreCase);
    }
}
