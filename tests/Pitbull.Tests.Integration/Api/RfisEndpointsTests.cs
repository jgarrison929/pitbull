using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreateChangeOrder;
using Pitbull.Contracts.Features.CreateSubcontract;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;
using Pitbull.Projects.Features.GetProjectRfiCostSummary;
using Pitbull.RFIs.Domain;
using Pitbull.RFIs.Features;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class RfisEndpointsTests(PostgresFixture db) : IAsyncLifetime
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

    private async Task<(HttpClient client, Guid projectId)> CreateAuthenticatedClientWithProjectAsync()
    {
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var createProject = new CreateProjectCommand(
            Name: $"RFI Test Project {Guid.NewGuid():N}",
            Number: $"PRJ-{Guid.NewGuid():N}",
            Description: "Test project for RFI integration tests",
            Type: ProjectType.Commercial,
            Address: null, City: null, State: null, ZipCode: null,
            ClientName: null, ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: null, EstimatedCompletionDate: null,
            ContractAmount: 100000m,
            ProjectManagerId: null, SuperintendentId: null, SourceBidId: null);

        var createResp = await client.PostAsJsonAsync("/api/projects", createProject);
        createResp.EnsureSuccessStatusCode();
        var project = await createResp.Content.ReadFromJsonAsync<ProjectDto>(TestJsonOptions.Default);

        return (client, project!.Id);
    }

    private async Task<Guid> CreateSubcontractForProjectAsync(HttpClient client, Guid projectId)
    {
        var subcontractCmd = new CreateSubcontractCommand(
            ProjectId: projectId,
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

        var resp = await client.PostAsJsonAsync("/api/subcontracts", subcontractCmd);
        resp.EnsureSuccessStatusCode();
        var subcontract = await resp.Content.ReadFromJsonAsync<SubcontractDto>(TestJsonOptions.Default);
        return subcontract!.Id;
    }

    [Fact]
    public async Task Get_rfis_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync($"/api/projects/{Guid.NewGuid()}/rfis");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Can_create_get_and_list_rfis_when_authenticated()
    {
        await db.ResetAsync();
        var (client, projectId) = await CreateAuthenticatedClientWithProjectAsync();

        // Create RFI
        var createRequest = new
        {
            Subject = "Foundation Depth Clarification",
            Question = "Drawing A2.1 shows 36 inch depth but specification calls for 42 inch. Please clarify.",
            Priority = RfiPriority.High,
            DueDate = DateTime.UtcNow.AddDays(7),
            BallInCourtName = "John Architect"
        };

        var createResp = await client.PostAsJsonAsync($"/api/projects/{projectId}/rfis", createRequest);
        if (createResp.StatusCode != HttpStatusCode.Created)
        {
            var body = await createResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 201 Created but got {(int)createResp.StatusCode}. Body: {body}");
        }

        var created = await createResp.Content.ReadFromJsonAsync<RfiDto>(TestJsonOptions.Default);
        Assert.NotNull(created);
        Assert.NotEqual(Guid.Empty, created.Id);
        Assert.Equal(1, created.Number); // First RFI in project should be number 1
        Assert.Equal("Foundation Depth Clarification", created.Subject);
        Assert.Equal(RfiStatus.Open, created.Status);
        Assert.Equal(RfiPriority.High, created.Priority);
        Assert.Equal("John Architect", created.BallInCourtName);

        // Get RFI by ID
        var getResp = await client.GetAsync($"/api/projects/{projectId}/rfis/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);

        var fetched = await getResp.Content.ReadFromJsonAsync<RfiDto>(TestJsonOptions.Default);
        Assert.NotNull(fetched);
        Assert.Equal(created.Id, fetched.Id);
        Assert.Equal(created.Subject, fetched.Subject);

        // List RFIs
        var listResp = await client.GetAsync($"/api/projects/{projectId}/rfis?page=1&pageSize=25");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains("Foundation Depth Clarification", listJson);
    }

    [Fact]
    public async Task Can_update_rfi_and_change_status()
    {
        await db.ResetAsync();
        var (client, projectId) = await CreateAuthenticatedClientWithProjectAsync();

        // Create RFI
        var createRequest = new
        {
            Subject = "Concrete PSI Specification",
            Question = "What is the required concrete PSI for the slab?",
            Priority = RfiPriority.Normal
        };

        var createResp = await client.PostAsJsonAsync($"/api/projects/{projectId}/rfis", createRequest);
        createResp.EnsureSuccessStatusCode();
        var created = await createResp.Content.ReadFromJsonAsync<RfiDto>(TestJsonOptions.Default);

        // Update RFI with answer (should transition to Answered)
        var updateRequest = new
        {
            Subject = "Concrete PSI Specification",
            Question = "What is the required concrete PSI for the slab?",
            Answer = "Use 4000 PSI concrete per spec section 03300.",
            Status = RfiStatus.Answered,
            Priority = RfiPriority.Normal
        };

        var updateResp = await client.PutAsJsonAsync($"/api/projects/{projectId}/rfis/{created!.Id}", updateRequest);
        Assert.Equal(HttpStatusCode.OK, updateResp.StatusCode);

        var updated = await updateResp.Content.ReadFromJsonAsync<RfiDto>(TestJsonOptions.Default);
        Assert.NotNull(updated);
        Assert.Equal(RfiStatus.Answered, updated.Status);
        Assert.Equal("Use 4000 PSI concrete per spec section 03300.", updated.Answer);
        Assert.NotNull(updated.AnsweredAt);
    }

    [Fact]
    public async Task Rfi_numbers_auto_increment_within_project()
    {
        await db.ResetAsync();
        var (client, projectId) = await CreateAuthenticatedClientWithProjectAsync();

        // Create first RFI
        var rfi1Resp = await client.PostAsJsonAsync($"/api/projects/{projectId}/rfis", new
        {
            Subject = "RFI #1",
            Question = "First question"
        });
        rfi1Resp.EnsureSuccessStatusCode();
        var rfi1 = await rfi1Resp.Content.ReadFromJsonAsync<RfiDto>(TestJsonOptions.Default);

        // Create second RFI
        var rfi2Resp = await client.PostAsJsonAsync($"/api/projects/{projectId}/rfis", new
        {
            Subject = "RFI #2",
            Question = "Second question"
        });
        rfi2Resp.EnsureSuccessStatusCode();
        var rfi2 = await rfi2Resp.Content.ReadFromJsonAsync<RfiDto>(TestJsonOptions.Default);

        // Create third RFI
        var rfi3Resp = await client.PostAsJsonAsync($"/api/projects/{projectId}/rfis", new
        {
            Subject = "RFI #3",
            Question = "Third question"
        });
        rfi3Resp.EnsureSuccessStatusCode();
        var rfi3 = await rfi3Resp.Content.ReadFromJsonAsync<RfiDto>(TestJsonOptions.Default);

        Assert.Equal(1, rfi1!.Number);
        Assert.Equal(2, rfi2!.Number);
        Assert.Equal(3, rfi3!.Number);
    }

    [Fact]
    public async Task Rfi_from_other_tenant_is_not_visible()
    {
        await db.ResetAsync();

        // Create RFI as Tenant A
        var (clientA, projectIdA) = await CreateAuthenticatedClientWithProjectAsync();
        var createResp = await clientA.PostAsJsonAsync($"/api/projects/{projectIdA}/rfis", new
        {
            Subject = "Tenant A Secret RFI",
            Question = "This should not be visible to Tenant B"
        });
        createResp.EnsureSuccessStatusCode();
        var rfi = await createResp.Content.ReadFromJsonAsync<RfiDto>(TestJsonOptions.Default);

        // Try to access as Tenant B (different client = different tenant)
        var (clientB, _, _) = await _factory.CreateAuthenticatedClientAsync();
        var getAsOtherTenant = await clientB.GetAsync($"/api/projects/{projectIdA}/rfis/{rfi!.Id}");

        // Should return 404 (not found for this tenant)
        Assert.Equal(HttpStatusCode.NotFound, getAsOtherTenant.StatusCode);
    }

    [Fact]
    public async Task List_rfis_with_status_filter()
    {
        await db.ResetAsync();
        var (client, projectId) = await CreateAuthenticatedClientWithProjectAsync();

        // Create open RFI
        var openResp = await client.PostAsJsonAsync($"/api/projects/{projectId}/rfis", new
        {
            Subject = "Open RFI",
            Question = "Open question"
        });
        openResp.EnsureSuccessStatusCode();

        // Create and answer another RFI
        var answeredResp = await client.PostAsJsonAsync($"/api/projects/{projectId}/rfis", new
        {
            Subject = "Answered RFI",
            Question = "Question that will be answered"
        });
        answeredResp.EnsureSuccessStatusCode();
        var answeredRfi = await answeredResp.Content.ReadFromJsonAsync<RfiDto>(TestJsonOptions.Default);

        await client.PutAsJsonAsync($"/api/projects/{projectId}/rfis/{answeredRfi!.Id}", new
        {
            Subject = "Answered RFI",
            Question = "Question that will be answered",
            Answer = "Here is the answer",
            Status = RfiStatus.Answered,
            Priority = RfiPriority.Normal
        });

        // Filter by Open status - should return 1
        var openFilterResp = await client.GetAsync($"/api/projects/{projectId}/rfis?status=Open");
        openFilterResp.EnsureSuccessStatusCode();
        var openListJson = await openFilterResp.Content.ReadAsStringAsync();
        Assert.Contains("Open RFI", openListJson);
        Assert.DoesNotContain("Answered RFI", openListJson);

        // Filter by Answered status - should return 1
        var answeredFilterResp = await client.GetAsync($"/api/projects/{projectId}/rfis?status=Answered");
        answeredFilterResp.EnsureSuccessStatusCode();
        var answeredListJson = await answeredFilterResp.Content.ReadAsStringAsync();
        Assert.Contains("Answered RFI", answeredListJson);
        Assert.DoesNotContain("Open RFI", answeredListJson);
    }

    [Fact]
    public async Task Get_nonexistent_rfi_returns_404()
    {
        await db.ResetAsync();
        var (client, projectId) = await CreateAuthenticatedClientWithProjectAsync();

        var getResp = await client.GetAsync($"/api/projects/{projectId}/rfis/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task Update_nonexistent_rfi_returns_404()
    {
        await db.ResetAsync();
        var (client, projectId) = await CreateAuthenticatedClientWithProjectAsync();

        var updateResp = await client.PutAsJsonAsync($"/api/projects/{projectId}/rfis/{Guid.NewGuid()}", new
        {
            Subject = "Updated Subject",
            Question = "Updated question",
            Status = RfiStatus.Open,
            Priority = RfiPriority.Normal
        });
        Assert.Equal(HttpStatusCode.NotFound, updateResp.StatusCode);
    }

    #region Cost Impact Tests

    [Fact]
    public async Task Get_rfi_cost_impact_returns_analysis_for_existing_rfi()
    {
        await db.ResetAsync();
        var (client, projectId) = await CreateAuthenticatedClientWithProjectAsync();

        // Create an RFI with cost impact fields
        var createRequest = new
        {
            Subject = "Structural Change Required",
            Question = "Foundation requires additional reinforcement per engineer review",
            Priority = RfiPriority.Urgent,
            DueDate = DateTime.UtcNow.AddDays(3)
        };

        var createResp = await client.PostAsJsonAsync($"/api/projects/{projectId}/rfis", createRequest);
        createResp.EnsureSuccessStatusCode();
        var rfi = await createResp.Content.ReadFromJsonAsync<RfiDto>(TestJsonOptions.Default);

        // Get cost impact
        var costImpactResp = await client.GetAsync($"/api/projects/{projectId}/rfis/{rfi!.Id}/cost-impact");
        Assert.Equal(HttpStatusCode.OK, costImpactResp.StatusCode);

        var impact = await costImpactResp.Content.ReadFromJsonAsync<RfiCostImpactDto>(TestJsonOptions.Default);
        Assert.NotNull(impact);
        Assert.Equal(rfi.Id, impact.RfiId);
        Assert.Equal(rfi.Number, impact.RfiNumber);
        Assert.Equal("Structural Change Required", impact.Subject);
        Assert.Equal("Open", impact.Status);
        Assert.True(impact.DaysOpen >= 0);
        Assert.NotNull(impact.ChangeOrders);
        Assert.NotNull(impact.Timeline);
        Assert.Contains(impact.Timeline, t => t.Event == "RFI Created");
    }

    [Fact]
    public async Task Get_rfi_cost_impact_returns_404_for_nonexistent_rfi()
    {
        await db.ResetAsync();
        var (client, projectId) = await CreateAuthenticatedClientWithProjectAsync();

        var costImpactResp = await client.GetAsync($"/api/projects/{projectId}/rfis/{Guid.NewGuid()}/cost-impact");
        Assert.Equal(HttpStatusCode.NotFound, costImpactResp.StatusCode);
    }

    [Fact]
    public async Task Get_rfi_cost_impact_calculates_days_open_correctly()
    {
        await db.ResetAsync();
        var (client, projectId) = await CreateAuthenticatedClientWithProjectAsync();

        var createRequest = new
        {
            Subject = "Clarification Needed",
            Question = "Please clarify drawing detail",
            Priority = RfiPriority.Normal
        };

        var createResp = await client.PostAsJsonAsync($"/api/projects/{projectId}/rfis", createRequest);
        createResp.EnsureSuccessStatusCode();
        var rfi = await createResp.Content.ReadFromJsonAsync<RfiDto>(TestJsonOptions.Default);

        var costImpactResp = await client.GetAsync($"/api/projects/{projectId}/rfis/{rfi!.Id}/cost-impact");
        var impact = await costImpactResp.Content.ReadFromJsonAsync<RfiCostImpactDto>(TestJsonOptions.Default);

        // Should be 0 or 1 days open (just created)
        Assert.True(impact!.DaysOpen >= 0 && impact.DaysOpen <= 1);
        Assert.Null(impact.AnsweredAt);  // Still open
        Assert.Null(impact.ClosedAt);
    }

    [Fact]
    public async Task Get_project_rfi_cost_summary_returns_aggregated_data()
    {
        await db.ResetAsync();
        var (client, projectId) = await CreateAuthenticatedClientWithProjectAsync();

        // Create multiple RFIs
        for (int i = 0; i < 3; i++)
        {
            var createResp = await client.PostAsJsonAsync($"/api/projects/{projectId}/rfis", new
            {
                Subject = $"RFI #{i + 1} for testing",
                Question = $"Question {i + 1}",
                Priority = i == 0 ? RfiPriority.Urgent : RfiPriority.Normal
            });
            createResp.EnsureSuccessStatusCode();
        }

        // Get project summary
        var summaryResp = await client.GetAsync($"/api/projects/{projectId}/rfi-cost-summary");
        Assert.Equal(HttpStatusCode.OK, summaryResp.StatusCode);

        var summary = await summaryResp.Content.ReadFromJsonAsync<ProjectRfiCostSummaryDto>(TestJsonOptions.Default);
        Assert.NotNull(summary);
        Assert.Equal(projectId, summary.ProjectId);
        Assert.Equal(3, summary.TotalRfis);
        Assert.Equal(3, summary.OpenRfis);  // All are open
        Assert.True(summary.TotalCost >= 0);
        Assert.NotNull(summary.TopCostlyRfis);
    }

    [Fact]
    public async Task Get_project_rfi_cost_summary_returns_404_for_nonexistent_project()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var summaryResp = await client.GetAsync($"/api/projects/{Guid.NewGuid()}/rfi-cost-summary");
        Assert.Equal(HttpStatusCode.NotFound, summaryResp.StatusCode);
    }

    [Fact]
    public async Task Get_rfi_cost_impact_returns_linked_change_orders()
    {
        await db.ResetAsync();
        var (client, projectId) = await CreateAuthenticatedClientWithProjectAsync();

        // Create an RFI
        var createRfiResp = await client.PostAsJsonAsync($"/api/projects/{projectId}/rfis", new
        {
            Subject = "Structural Change Required",
            Question = "Foundation requires additional reinforcement per engineer review",
            Priority = RfiPriority.Urgent,
            DueDate = DateTime.UtcNow.AddDays(3)
        });
        createRfiResp.EnsureSuccessStatusCode();
        var rfi = await createRfiResp.Content.ReadFromJsonAsync<RfiDto>(TestJsonOptions.Default);

        // Create a subcontract
        var subcontractId = await CreateSubcontractForProjectAsync(client, projectId);

        // Create change orders linked to this RFI
        var co1Cmd = new CreateChangeOrderCommand(
            SubcontractId: subcontractId,
            ChangeOrderNumber: $"CO-001-{Guid.NewGuid():N}",
            Title: "Additional Foundation Reinforcement",
            Description: "Per RFI structural requirement",
            Reason: "RFI-directed change",
            Amount: 15_000m,
            DaysExtension: 5,
            ReferenceNumber: null,
            OriginatingRfiId: rfi!.Id
        );
        var co1Resp = await client.PostAsJsonAsync("/api/changeorders", co1Cmd);
        co1Resp.EnsureSuccessStatusCode();

        var co2Cmd = new CreateChangeOrderCommand(
            SubcontractId: subcontractId,
            ChangeOrderNumber: $"CO-002-{Guid.NewGuid():N}",
            Title: "Engineering Review Fees",
            Description: "Additional engineering review required",
            Reason: "RFI-directed change",
            Amount: 5_000m,
            DaysExtension: null,
            ReferenceNumber: null,
            OriginatingRfiId: rfi.Id
        );
        var co2Resp = await client.PostAsJsonAsync("/api/changeorders", co2Cmd);
        co2Resp.EnsureSuccessStatusCode();

        // Get cost impact - should show linked change orders
        var costImpactResp = await client.GetAsync($"/api/projects/{projectId}/rfis/{rfi.Id}/cost-impact");
        Assert.Equal(HttpStatusCode.OK, costImpactResp.StatusCode);

        var impact = await costImpactResp.Content.ReadFromJsonAsync<RfiCostImpactDto>(TestJsonOptions.Default);
        Assert.NotNull(impact);
        Assert.Equal(rfi.Id, impact.RfiId);
        Assert.Equal(2, impact.ChangeOrders.Count);
        Assert.Equal(20_000m, impact.DirectCost); // 15000 + 5000
        Assert.Contains(impact.ChangeOrders, co => co.Title == "Additional Foundation Reinforcement" && co.Amount == 15_000m);
        Assert.Contains(impact.ChangeOrders, co => co.Title == "Engineering Review Fees" && co.Amount == 5_000m);
    }

    [Fact]
    public async Task Get_project_rfi_cost_summary_includes_linked_change_order_costs()
    {
        await db.ResetAsync();
        var (client, projectId) = await CreateAuthenticatedClientWithProjectAsync();

        // Create a subcontract
        var subcontractId = await CreateSubcontractForProjectAsync(client, projectId);

        // Create first RFI with linked change order
        var rfi1Resp = await client.PostAsJsonAsync($"/api/projects/{projectId}/rfis", new
        {
            Subject = "RFI #1 with costs",
            Question = "Question 1",
            Priority = RfiPriority.Urgent
        });
        rfi1Resp.EnsureSuccessStatusCode();
        var rfi1 = await rfi1Resp.Content.ReadFromJsonAsync<RfiDto>(TestJsonOptions.Default);

        var co1Cmd = new CreateChangeOrderCommand(
            SubcontractId: subcontractId,
            ChangeOrderNumber: $"CO-A-{Guid.NewGuid():N}",
            Title: "Change Order for RFI 1",
            Description: "Linked to first RFI",
            Reason: null,
            Amount: 10_000m,
            DaysExtension: 3,
            ReferenceNumber: null,
            OriginatingRfiId: rfi1!.Id
        );
        await client.PostAsJsonAsync("/api/changeorders", co1Cmd);

        // Create second RFI with linked change order
        var rfi2Resp = await client.PostAsJsonAsync($"/api/projects/{projectId}/rfis", new
        {
            Subject = "RFI #2 with costs",
            Question = "Question 2",
            Priority = RfiPriority.Normal
        });
        rfi2Resp.EnsureSuccessStatusCode();
        var rfi2 = await rfi2Resp.Content.ReadFromJsonAsync<RfiDto>(TestJsonOptions.Default);

        var co2Cmd = new CreateChangeOrderCommand(
            SubcontractId: subcontractId,
            ChangeOrderNumber: $"CO-B-{Guid.NewGuid():N}",
            Title: "Change Order for RFI 2",
            Description: "Linked to second RFI",
            Reason: null,
            Amount: 25_000m,
            DaysExtension: 7,
            ReferenceNumber: null,
            OriginatingRfiId: rfi2!.Id
        );
        await client.PostAsJsonAsync("/api/changeorders", co2Cmd);

        // Create third RFI with NO linked change order
        var rfi3Resp = await client.PostAsJsonAsync($"/api/projects/{projectId}/rfis", new
        {
            Subject = "RFI #3 no costs",
            Question = "Question 3",
            Priority = RfiPriority.Normal
        });
        rfi3Resp.EnsureSuccessStatusCode();

        // Get project summary - should aggregate all costs
        var summaryResp = await client.GetAsync($"/api/projects/{projectId}/rfi-cost-summary");
        Assert.Equal(HttpStatusCode.OK, summaryResp.StatusCode);

        var summary = await summaryResp.Content.ReadFromJsonAsync<ProjectRfiCostSummaryDto>(TestJsonOptions.Default);
        Assert.NotNull(summary);
        Assert.Equal(projectId, summary.ProjectId);
        Assert.Equal(3, summary.TotalRfis);
        Assert.Equal(3, summary.OpenRfis);
        Assert.Equal(2, summary.RfisWithCostImpact);  // 2 RFIs have linked COs
        Assert.Equal(35_000m, summary.TotalDirectCost); // 10000 + 25000
        Assert.Equal(35_000m, summary.TotalCost); // Same as DirectCost when no delay costs
    }

    [Fact]
    public async Task Get_rfi_cost_impact_without_linked_change_orders_returns_zero_costs()
    {
        await db.ResetAsync();
        var (client, projectId) = await CreateAuthenticatedClientWithProjectAsync();

        // Create an RFI with no linked change orders
        var createRfiResp = await client.PostAsJsonAsync($"/api/projects/{projectId}/rfis", new
        {
            Subject = "RFI without cost impact",
            Question = "This RFI has no associated change orders",
            Priority = RfiPriority.Normal
        });
        createRfiResp.EnsureSuccessStatusCode();
        var rfi = await createRfiResp.Content.ReadFromJsonAsync<RfiDto>(TestJsonOptions.Default);

        // Get cost impact
        var costImpactResp = await client.GetAsync($"/api/projects/{projectId}/rfis/{rfi!.Id}/cost-impact");
        Assert.Equal(HttpStatusCode.OK, costImpactResp.StatusCode);

        var impact = await costImpactResp.Content.ReadFromJsonAsync<RfiCostImpactDto>(TestJsonOptions.Default);
        Assert.NotNull(impact);
        Assert.Equal(rfi.Id, impact.RfiId);
        Assert.Empty(impact.ChangeOrders);
        Assert.Equal(0m, impact.DirectCost);
        Assert.Equal(0m, impact.TotalCost);
    }

    #endregion
}
