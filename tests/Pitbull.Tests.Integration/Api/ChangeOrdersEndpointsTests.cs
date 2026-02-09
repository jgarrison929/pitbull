using System.Net;
using System.Net.Http.Json;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreateChangeOrder;
using Pitbull.Contracts.Features.CreateSubcontract;
using Pitbull.Contracts.Features.UpdateChangeOrder;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class ChangeOrdersEndpointsTests(PostgresFixture db) : IAsyncLifetime
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

    private async Task<(HttpClient client, Guid projectId, Guid subcontractId)> SetupProjectAndSubcontractAsync()
    {
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create project
        var projectCmd = new CreateProjectCommand(
            Name: "Change Order Test Project",
            Number: $"PRJ-{Guid.NewGuid():N}",
            Description: null,
            Type: ProjectType.Commercial,
            Address: null, City: null, State: null, ZipCode: null,
            ClientName: null, ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: null, EstimatedCompletionDate: null,
            ContractAmount: 500_000m,
            ProjectManagerId: null, SuperintendentId: null, SourceBidId: null);

        var projectResp = await client.PostAsJsonAsync("/api/projects", projectCmd);
        projectResp.EnsureSuccessStatusCode();
        var project = (await projectResp.Content.ReadFromJsonAsync<ProjectDto>())!;

        // Create subcontract
        var subcontractCmd = new CreateSubcontractCommand(
            ProjectId: project.Id,
            SubcontractNumber: $"SC-{Guid.NewGuid():N}",
            SubcontractorName: "Test Subcontractor",
            SubcontractorContact: null,
            SubcontractorEmail: null,
            SubcontractorPhone: null,
            SubcontractorAddress: null,
            ScopeOfWork: "Test scope of work",
            TradeCode: null,
            OriginalValue: 100_000m,
            RetainagePercent: 10m,
            StartDate: null,
            CompletionDate: null,
            LicenseNumber: null,
            Notes: null);

        var scResp = await client.PostAsJsonAsync("/api/subcontracts", subcontractCmd);
        scResp.EnsureSuccessStatusCode();
        var subcontract = (await scResp.Content.ReadFromJsonAsync<SubcontractDto>())!;

        return (client, project.Id, subcontract.Id);
    }

    [Fact]
    public async Task Get_changeorders_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/changeorders");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Can_create_get_and_list_change_orders()
    {
        await db.ResetAsync();

        var (client, _, subcontractId) = await SetupProjectAndSubcontractAsync();

        // Create a change order
        var coCmd = new CreateChangeOrderCommand(
            SubcontractId: subcontractId,
            ChangeOrderNumber: $"CO-{Guid.NewGuid():N}",
            Title: "Additional Foundation Work",
            Description: "Extended footings required due to soil conditions",
            Reason: "Field condition",
            Amount: 15_000m,
            DaysExtension: 5,
            ReferenceNumber: "REF-001");

        var createResp = await client.PostAsJsonAsync("/api/changeorders", coCmd);
        if (createResp.StatusCode != HttpStatusCode.Created)
        {
            var body = await createResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 201 Created but got {(int)createResp.StatusCode}. Body: {body}");
        }

        var created = (await createResp.Content.ReadFromJsonAsync<ChangeOrderDto>())!;
        Assert.NotEqual(Guid.Empty, created.Id);
        Assert.Equal(coCmd.Title, created.Title);
        Assert.Equal(coCmd.Amount, created.Amount);
        Assert.Equal(coCmd.DaysExtension, created.DaysExtension);
        Assert.Equal(ChangeOrderStatus.Pending, created.Status);

        // Get by ID
        var getResp = await client.GetAsync($"/api/changeorders/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);

        var fetched = (await getResp.Content.ReadFromJsonAsync<ChangeOrderDto>())!;
        Assert.Equal(created.Id, fetched.Id);
        Assert.Equal(coCmd.ChangeOrderNumber, fetched.ChangeOrderNumber);

        // List
        var listResp = await client.GetAsync("/api/changeorders?page=1&pageSize=25");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains(coCmd.ChangeOrderNumber, listJson);
    }

    [Fact]
    public async Task Change_order_from_other_tenant_is_not_visible()
    {
        await db.ResetAsync();

        // Tenant A creates project, subcontract, and change order
        var (clientA, _, subcontractIdA) = await SetupProjectAndSubcontractAsync();

        var coCmd = new CreateChangeOrderCommand(
            SubcontractId: subcontractIdA,
            ChangeOrderNumber: $"CO-A-{Guid.NewGuid():N}",
            Title: "Tenant A Change Order",
            Description: "Should not be visible to Tenant B",
            Reason: null,
            Amount: 5_000m,
            DaysExtension: null,
            ReferenceNumber: null);

        var createResp = await clientA.PostAsJsonAsync("/api/changeorders", coCmd);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<ChangeOrderDto>())!;

        // Create Tenant B client
        var (clientB, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Tenant B should not see it
        var getAsOtherTenant = await clientB.GetAsync($"/api/changeorders/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getAsOtherTenant.StatusCode);

        // Tenant B's list should not contain it
        var listResp = await clientB.GetAsync("/api/changeorders?page=1&pageSize=100");
        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.DoesNotContain(coCmd.ChangeOrderNumber, listJson);
    }

    [Fact]
    public async Task Change_order_for_nonexistent_subcontract_returns_400()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var coCmd = new CreateChangeOrderCommand(
            SubcontractId: Guid.NewGuid(), // doesn't exist
            ChangeOrderNumber: "CO-INVALID",
            Title: "Invalid Change Order",
            Description: "Subcontract doesn't exist",
            Reason: null,
            Amount: 1_000m,
            DaysExtension: null,
            ReferenceNumber: null);

        var resp = await client.PostAsJsonAsync("/api/changeorders", coCmd);

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var body = await resp.Content.ReadAsStringAsync();
        Assert.Contains("not found", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Can_update_change_order_status_to_approved()
    {
        await db.ResetAsync();

        var (client, _, subcontractId) = await SetupProjectAndSubcontractAsync();

        // Create a change order
        var coCmd = new CreateChangeOrderCommand(
            SubcontractId: subcontractId,
            ChangeOrderNumber: $"CO-{Guid.NewGuid():N}",
            Title: "Value Increase",
            Description: "Testing status update",
            Reason: "Scope addition",
            Amount: 10_000m,
            DaysExtension: 3,
            ReferenceNumber: "REF-002");

        var createResp = await client.PostAsJsonAsync("/api/changeorders", coCmd);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<ChangeOrderDto>())!;
        Assert.Equal(ChangeOrderStatus.Pending, created.Status);
        Assert.Null(created.ApprovedDate);

        // Update status to Approved via PUT
        var updatePayload = new
        {
            id = created.Id,
            changeOrderNumber = created.ChangeOrderNumber,
            title = created.Title,
            description = created.Description,
            reason = created.Reason,
            amount = created.Amount,
            daysExtension = created.DaysExtension,
            status = (int)ChangeOrderStatus.Approved,
            referenceNumber = created.ReferenceNumber
        };

        var updateResp = await client.PutAsJsonAsync($"/api/changeorders/{created.Id}", updatePayload);
        if (updateResp.StatusCode != HttpStatusCode.OK)
        {
            var body = await updateResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 200 OK but got {(int)updateResp.StatusCode}. Body: {body}");
        }

        var updated = (await updateResp.Content.ReadFromJsonAsync<ChangeOrderDto>())!;
        Assert.Equal(ChangeOrderStatus.Approved, updated.Status);
        Assert.NotNull(updated.ApprovedDate);
    }

    [Fact]
    public async Task Can_delete_change_order()
    {
        await db.ResetAsync();

        var (client, _, subcontractId) = await SetupProjectAndSubcontractAsync();

        // Create a change order to delete
        var coCmd = new CreateChangeOrderCommand(
            SubcontractId: subcontractId,
            ChangeOrderNumber: $"CO-DEL-{Guid.NewGuid():N}",
            Title: "To Be Deleted",
            Description: "This will be deleted",
            Reason: null,
            Amount: 5_000m,
            DaysExtension: null,
            ReferenceNumber: null);

        var createResp = await client.PostAsJsonAsync("/api/changeorders", coCmd);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<ChangeOrderDto>())!;

        // Delete
        var deleteResp = await client.DeleteAsync($"/api/changeorders/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

        // Verify deleted (soft delete - should return 404)
        var getResp = await client.GetAsync($"/api/changeorders/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task Can_filter_change_orders_by_subcontract()
    {
        await db.ResetAsync();

        var (client, projectId, subcontract1Id) = await SetupProjectAndSubcontractAsync();

        // Create a second subcontract in the same project
        var sc2Cmd = new CreateSubcontractCommand(
            ProjectId: projectId,
            SubcontractNumber: $"SC-2-{Guid.NewGuid():N}",
            SubcontractorName: "Second Subcontractor",
            SubcontractorContact: null, SubcontractorEmail: null, SubcontractorPhone: null, SubcontractorAddress: null,
            ScopeOfWork: "Second scope", TradeCode: null,
            OriginalValue: 50_000m, RetainagePercent: 10m,
            StartDate: null, CompletionDate: null, LicenseNumber: null, Notes: null);

        var sc2Resp = await client.PostAsJsonAsync("/api/subcontracts", sc2Cmd);
        sc2Resp.EnsureSuccessStatusCode();
        var subcontract2 = (await sc2Resp.Content.ReadFromJsonAsync<SubcontractDto>())!;

        // Create change orders for each subcontract  
        var co1Cmd = new CreateChangeOrderCommand(
            SubcontractId: subcontract1Id,
            ChangeOrderNumber: $"CO-SC1-{Guid.NewGuid():N}",
            Title: "Change Order for SC1",
            Description: "Test description for SC1", Reason: null,
            Amount: 2_000m, DaysExtension: null, ReferenceNumber: null);

        var co2Cmd = new CreateChangeOrderCommand(
            SubcontractId: subcontract2.Id,
            ChangeOrderNumber: $"CO-SC2-{Guid.NewGuid():N}",
            Title: "Change Order for SC2",
            Description: "Test description for SC2", Reason: null,
            Amount: 3_000m, DaysExtension: null, ReferenceNumber: null);

        var co1Resp = await client.PostAsJsonAsync("/api/changeorders", co1Cmd);
        co1Resp.EnsureSuccessStatusCode();
        var co1 = (await co1Resp.Content.ReadFromJsonAsync<ChangeOrderDto>())!;

        var co2Resp = await client.PostAsJsonAsync("/api/changeorders", co2Cmd);
        co2Resp.EnsureSuccessStatusCode();
        var co2 = (await co2Resp.Content.ReadFromJsonAsync<ChangeOrderDto>())!;

        // Filter by first subcontract
        var filteredResp = await client.GetAsync($"/api/changeorders?subcontractId={subcontract1Id}");
        filteredResp.EnsureSuccessStatusCode();

        var filteredJson = await filteredResp.Content.ReadAsStringAsync();
        Assert.Contains(co1.ChangeOrderNumber, filteredJson);
        Assert.DoesNotContain(co2.ChangeOrderNumber, filteredJson);
    }

    [Fact]
    public async Task Can_filter_change_orders_by_status()
    {
        await db.ResetAsync();

        var (client, _, subcontractId) = await SetupProjectAndSubcontractAsync();

        // Create first change order
        var firstCo = new CreateChangeOrderCommand(
            SubcontractId: subcontractId,
            ChangeOrderNumber: $"CO-FIRST-{Guid.NewGuid():N}",
            Title: "First Change Order",
            Description: "First CO description", Reason: null,
            Amount: 1_000m, DaysExtension: null, ReferenceNumber: null);

        var createResp = await client.PostAsJsonAsync("/api/changeorders", firstCo);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<ChangeOrderDto>())!;

        // Approve this one using the typed command
        var updateCmd = new UpdateChangeOrderCommand(
            Id: created.Id,
            ChangeOrderNumber: created.ChangeOrderNumber,
            Title: created.Title,
            Description: created.Description ?? "",
            Reason: created.Reason,
            Amount: created.Amount,
            DaysExtension: created.DaysExtension,
            Status: ChangeOrderStatus.Approved,
            ReferenceNumber: created.ReferenceNumber
        );
        var approveResp = await client.PutAsJsonAsync($"/api/changeorders/{created.Id}", updateCmd);
        approveResp.EnsureSuccessStatusCode();

        // Create another pending one
        var pending2Co = new CreateChangeOrderCommand(
            SubcontractId: subcontractId,
            ChangeOrderNumber: $"CO-PEND2-{Guid.NewGuid():N}",
            Title: "Still Pending",
            Description: "Pending CO description", Reason: null,
            Amount: 2_000m, DaysExtension: null, ReferenceNumber: null);
        await client.PostAsJsonAsync("/api/changeorders", pending2Co);

        // Filter by Pending status
        var pendingResp = await client.GetAsync($"/api/changeorders?status={(int)ChangeOrderStatus.Pending}");
        pendingResp.EnsureSuccessStatusCode();

        var pendingJson = await pendingResp.Content.ReadAsStringAsync();
        Assert.Contains("Still Pending", pendingJson);
        Assert.DoesNotContain("First Change Order", pendingJson);

        // Filter by Approved status
        var approvedResp = await client.GetAsync($"/api/changeorders?status={(int)ChangeOrderStatus.Approved}");
        approvedResp.EnsureSuccessStatusCode();

        var approvedJson = await approvedResp.Content.ReadAsStringAsync();
        Assert.Contains("First Change Order", approvedJson); // This was approved
        Assert.DoesNotContain("Still Pending", approvedJson);
    }

    [Fact]
    public async Task Cannot_delete_nonexistent_change_order()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var deleteResp = await client.DeleteAsync($"/api/changeorders/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, deleteResp.StatusCode);
    }
}
