using System.Net;
using System.Net.Http.Json;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreateSubcontract;
using Pitbull.Contracts.Features.UpdateSubcontract;
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

    [Fact]
    public async Task Can_update_subcontract()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create project
        var projectCmd = new CreateProjectCommand(
            Name: "Update Test Project",
            Number: $"PRJ-UPD-{Guid.NewGuid():N}",
            Description: null,
            Type: ProjectType.Commercial,
            Address: null, City: null, State: null, ZipCode: null,
            ClientName: null, ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: null, EstimatedCompletionDate: null,
            ContractAmount: 200_000m,
            ProjectManagerId: null, SuperintendentId: null, SourceBidId: null);

        var projectResp = await client.PostAsJsonAsync("/api/projects", projectCmd);
        projectResp.EnsureSuccessStatusCode();
        var project = (await projectResp.Content.ReadFromJsonAsync<ProjectDto>())!;

        // Create subcontract
        var createCmd = new CreateSubcontractCommand(
            ProjectId: project.Id,
            SubcontractNumber: $"SC-UPD-{Guid.NewGuid():N}",
            SubcontractorName: "Original Subcontractor",
            SubcontractorContact: "Original Contact",
            SubcontractorEmail: "original@test.com",
            SubcontractorPhone: "555-000-0000",
            SubcontractorAddress: "123 Original St",
            ScopeOfWork: "Original scope",
            TradeCode: "01",
            OriginalValue: 50_000m,
            RetainagePercent: 10m,
            StartDate: DateTime.UtcNow,
            CompletionDate: DateTime.UtcNow.AddMonths(1),
            LicenseNumber: "LIC-001",
            Notes: "Original notes");

        var createResp = await client.PostAsJsonAsync("/api/subcontracts", createCmd);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<SubcontractDto>())!;

        // Update
        var updateCmd = new UpdateSubcontractCommand(
            Id: created.Id,
            SubcontractNumber: created.SubcontractNumber,
            SubcontractorName: "Updated Subcontractor Name",
            SubcontractorContact: "Updated Contact",
            SubcontractorEmail: "updated@test.com",
            SubcontractorPhone: "555-999-9999",
            SubcontractorAddress: "456 Updated Ave",
            ScopeOfWork: "Updated scope of work",
            TradeCode: "02",
            OriginalValue: 60_000m,
            RetainagePercent: 5m,
            ExecutionDate: DateTime.UtcNow,
            StartDate: DateTime.UtcNow,
            CompletionDate: DateTime.UtcNow.AddMonths(2),
            Status: SubcontractStatus.Executed,
            InsuranceExpirationDate: DateTime.UtcNow.AddYears(1),
            InsuranceCurrent: true,
            LicenseNumber: "LIC-002",
            Notes: "Updated notes");

        var updateResp = await client.PutAsJsonAsync($"/api/subcontracts/{created.Id}", updateCmd);
        if (updateResp.StatusCode != HttpStatusCode.OK)
        {
            var body = await updateResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 200 OK but got {(int)updateResp.StatusCode}. Body: {body}");
        }

        var updated = (await updateResp.Content.ReadFromJsonAsync<SubcontractDto>())!;
        Assert.Equal("Updated Subcontractor Name", updated.SubcontractorName);
        Assert.Equal("updated@test.com", updated.SubcontractorEmail);
        Assert.Equal(SubcontractStatus.Executed, updated.Status);
        Assert.Equal(60_000m, updated.OriginalValue);
    }

    [Fact]
    public async Task Update_subcontract_with_mismatched_id_returns_400()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create project
        var projectCmd = new CreateProjectCommand(
            Name: "Mismatch Test Project",
            Number: $"PRJ-MISMATCH-{Guid.NewGuid():N}",
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

        // Create subcontract
        var createCmd = new CreateSubcontractCommand(
            ProjectId: project.Id,
            SubcontractNumber: $"SC-MISMATCH-{Guid.NewGuid():N}",
            SubcontractorName: "Test Subcontractor",
            SubcontractorContact: null,
            SubcontractorEmail: null,
            SubcontractorPhone: null,
            SubcontractorAddress: null,
            ScopeOfWork: "Test scope",
            TradeCode: null,
            OriginalValue: 25_000m,
            RetainagePercent: 10m,
            StartDate: null,
            CompletionDate: null,
            LicenseNumber: null,
            Notes: null);

        var createResp = await client.PostAsJsonAsync("/api/subcontracts", createCmd);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<SubcontractDto>())!;

        // Update with mismatched ID in body
        var differentId = Guid.NewGuid();
        var updateCmd = new UpdateSubcontractCommand(
            Id: differentId, // Different from route
            SubcontractNumber: created.SubcontractNumber,
            SubcontractorName: "Should Fail",
            SubcontractorContact: null,
            SubcontractorEmail: null,
            SubcontractorPhone: null,
            SubcontractorAddress: null,
            ScopeOfWork: "Test scope",
            TradeCode: null,
            OriginalValue: 25_000m,
            RetainagePercent: 10m,
            ExecutionDate: null,
            StartDate: null,
            CompletionDate: null,
            Status: SubcontractStatus.Draft,
            InsuranceExpirationDate: null,
            InsuranceCurrent: false,
            LicenseNumber: null,
            Notes: null);

        var resp = await client.PutAsJsonAsync($"/api/subcontracts/{created.Id}", updateCmd);

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Can_delete_subcontract()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create project
        var projectCmd = new CreateProjectCommand(
            Name: "Delete Test Project",
            Number: $"PRJ-DEL-{Guid.NewGuid():N}",
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

        // Create subcontract
        var createCmd = new CreateSubcontractCommand(
            ProjectId: project.Id,
            SubcontractNumber: $"SC-DEL-{Guid.NewGuid():N}",
            SubcontractorName: "To Be Deleted",
            SubcontractorContact: null,
            SubcontractorEmail: null,
            SubcontractorPhone: null,
            SubcontractorAddress: null,
            ScopeOfWork: "Will be deleted",
            TradeCode: null,
            OriginalValue: 10_000m,
            RetainagePercent: 10m,
            StartDate: null,
            CompletionDate: null,
            LicenseNumber: null,
            Notes: null);

        var createResp = await client.PostAsJsonAsync("/api/subcontracts", createCmd);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<SubcontractDto>())!;

        // Delete
        var deleteResp = await client.DeleteAsync($"/api/subcontracts/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

        // Verify deleted (soft delete - should return 404)
        var getResp = await client.GetAsync($"/api/subcontracts/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task Delete_nonexistent_subcontract_returns_404()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var nonexistentId = Guid.NewGuid();
        var resp = await client.DeleteAsync($"/api/subcontracts/{nonexistentId}");

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Can_filter_subcontracts_by_project()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create two projects
        var project1Cmd = new CreateProjectCommand(
            Name: "Filter Project 1",
            Number: $"PRJ-F1-{Guid.NewGuid():N}",
            Description: null,
            Type: ProjectType.Commercial,
            Address: null, City: null, State: null, ZipCode: null,
            ClientName: null, ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: null, EstimatedCompletionDate: null,
            ContractAmount: 100_000m,
            ProjectManagerId: null, SuperintendentId: null, SourceBidId: null);

        var project2Cmd = new CreateProjectCommand(
            Name: "Filter Project 2",
            Number: $"PRJ-F2-{Guid.NewGuid():N}",
            Description: null,
            Type: ProjectType.Residential,
            Address: null, City: null, State: null, ZipCode: null,
            ClientName: null, ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: null, EstimatedCompletionDate: null,
            ContractAmount: 200_000m,
            ProjectManagerId: null, SuperintendentId: null, SourceBidId: null);

        var p1Resp = await client.PostAsJsonAsync("/api/projects", project1Cmd);
        var p2Resp = await client.PostAsJsonAsync("/api/projects", project2Cmd);
        p1Resp.EnsureSuccessStatusCode();
        p2Resp.EnsureSuccessStatusCode();
        var project1 = (await p1Resp.Content.ReadFromJsonAsync<ProjectDto>())!;
        var project2 = (await p2Resp.Content.ReadFromJsonAsync<ProjectDto>())!;

        // Create subcontract for each project
        var sc1Number = $"SC-P1-{Guid.NewGuid():N}"[..20];
        var sc2Number = $"SC-P2-{Guid.NewGuid():N}"[..20];

        var sc1Cmd = new CreateSubcontractCommand(
            ProjectId: project1.Id,
            SubcontractNumber: sc1Number,
            SubcontractorName: "Project 1 Sub",
            SubcontractorContact: null, SubcontractorEmail: null, SubcontractorPhone: null, SubcontractorAddress: null,
            ScopeOfWork: "Scope 1", TradeCode: null,
            OriginalValue: 25_000m, RetainagePercent: 10m,
            StartDate: null, CompletionDate: null, LicenseNumber: null, Notes: null);

        var sc2Cmd = new CreateSubcontractCommand(
            ProjectId: project2.Id,
            SubcontractNumber: sc2Number,
            SubcontractorName: "Project 2 Sub",
            SubcontractorContact: null, SubcontractorEmail: null, SubcontractorPhone: null, SubcontractorAddress: null,
            ScopeOfWork: "Scope 2", TradeCode: null,
            OriginalValue: 35_000m, RetainagePercent: 10m,
            StartDate: null, CompletionDate: null, LicenseNumber: null, Notes: null);

        await client.PostAsJsonAsync("/api/subcontracts", sc1Cmd);
        await client.PostAsJsonAsync("/api/subcontracts", sc2Cmd);

        // Filter by project 1
        var filteredResp = await client.GetAsync($"/api/subcontracts?projectId={project1.Id}");
        filteredResp.EnsureSuccessStatusCode();

        var filteredJson = await filteredResp.Content.ReadAsStringAsync();
        Assert.Contains(sc1Number, filteredJson);
        Assert.DoesNotContain(sc2Number, filteredJson);
    }

    [Fact]
    public async Task Can_search_subcontracts_by_name()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create project
        var projectCmd = new CreateProjectCommand(
            Name: "Search Test Project",
            Number: $"PRJ-SRCH-{Guid.NewGuid():N}",
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

        // Create subcontracts with different names
        var uniqueId = Guid.NewGuid().ToString("N")[..8];
        var sc1Cmd = new CreateSubcontractCommand(
            ProjectId: project.Id,
            SubcontractNumber: $"SC-1-{uniqueId}",
            SubcontractorName: $"Alpha Electric {uniqueId}",
            SubcontractorContact: null, SubcontractorEmail: null, SubcontractorPhone: null, SubcontractorAddress: null,
            ScopeOfWork: "Electrical", TradeCode: null,
            OriginalValue: 50_000m, RetainagePercent: 10m,
            StartDate: null, CompletionDate: null, LicenseNumber: null, Notes: null);

        var sc2Cmd = new CreateSubcontractCommand(
            ProjectId: project.Id,
            SubcontractNumber: $"SC-2-{uniqueId}",
            SubcontractorName: $"Beta Plumbing {uniqueId}",
            SubcontractorContact: null, SubcontractorEmail: null, SubcontractorPhone: null, SubcontractorAddress: null,
            ScopeOfWork: "Plumbing", TradeCode: null,
            OriginalValue: 40_000m, RetainagePercent: 10m,
            StartDate: null, CompletionDate: null, LicenseNumber: null, Notes: null);

        await client.PostAsJsonAsync("/api/subcontracts", sc1Cmd);
        await client.PostAsJsonAsync("/api/subcontracts", sc2Cmd);

        // Search for "Alpha" (just the common prefix to find it)
        var searchResp = await client.GetAsync($"/api/subcontracts?search=Alpha");
        searchResp.EnsureSuccessStatusCode();

        var searchJson = await searchResp.Content.ReadAsStringAsync();
        Assert.Contains("Alpha Electric", searchJson);
        Assert.DoesNotContain("Beta Plumbing", searchJson);
    }

    [Fact]
    public async Task Cannot_update_nonexistent_subcontract()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var fakeId = Guid.NewGuid();
        var updateCmd = new UpdateSubcontractCommand(
            Id: fakeId,
            SubcontractNumber: "SC-FAKE",
            SubcontractorName: "Fake Sub",
            SubcontractorContact: null, SubcontractorEmail: null, SubcontractorPhone: null, SubcontractorAddress: null,
            ScopeOfWork: "Fake", TradeCode: null,
            OriginalValue: 1000m, RetainagePercent: 10m,
            ExecutionDate: null, StartDate: null, CompletionDate: null,
            Status: SubcontractStatus.Draft,
            InsuranceExpirationDate: null, InsuranceCurrent: false,
            LicenseNumber: null, Notes: null);

        var updateResp = await client.PutAsJsonAsync($"/api/subcontracts/{fakeId}", updateCmd);
        Assert.Equal(HttpStatusCode.NotFound, updateResp.StatusCode);
    }
}
