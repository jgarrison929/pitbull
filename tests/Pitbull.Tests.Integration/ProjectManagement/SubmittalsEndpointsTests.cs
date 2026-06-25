using System.Net;
using System.Net.Http.Json;
using Pitbull.ProjectManagement.Features;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.ProjectManagement;

[Collection(DatabaseCollection.Name)]
public sealed class SubmittalsEndpointsTests(PostgresFixture db) : ApiIntegrationTestBase(db)
{
    [Fact]
    public async Task Get_submittals_without_auth_returns_401()
    {
        await Db.ResetAsync();
        using var client = Factory.CreateClient();

        var resp = await client.GetAsync($"/api/projects/{Guid.NewGuid()}/submittals");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Can_create_update_and_add_workflow_event_to_submittal()
    {
        await Db.ResetAsync();
        var (client, auth, _) = await CreateAuthenticatedClientAsync();
        var projectId = await CreateProjectAsync(client, "Submittal");

        var createResp = await client.PostAsJsonAsync($"/api/projects/{projectId}/submittals", new PmUpsertRequest(
            Title: "Shop Drawing 033000",
            Data: new Dictionary<string, object?>
            {
                ["SubmittalType"] = "ShopDrawing",
                ["SpecificationSection"] = "033000"
            }));
        createResp.EnsureSuccessStatusCode();
        var submittalId = await ReadIdAsync(createResp);

        var submitResp = await client.PutAsJsonAsync($"/api/projects/{projectId}/submittals/{submittalId}", new PmUpsertRequest(
            Status: "Submitted"));
        submitResp.EnsureSuccessStatusCode();

        var workflowResp = await client.PostAsJsonAsync($"/api/projects/{projectId}/submittals/{submittalId}/workflow", new PmUpsertRequest(
            Title: "Submitted to architect",
            Status: "Submitted",
            Data: new Dictionary<string, object?>
            {
                ["EventType"] = "Submitted",
                ["FromStatus"] = "Draft",
                ["ToStatus"] = "Submitted",
                ["ActionByUserId"] = auth.UserId
            }));
        workflowResp.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Submittal_is_not_visible_across_tenants_and_wrong_project_route_returns_404()
    {
        await Db.ResetAsync();

        var (tenantAClient, _, _) = await CreateAuthenticatedClientAsync();
        var tenantAProjectId = await CreateProjectAsync(tenantAClient, "Submittal-TenantA");

        var submittalResp = await tenantAClient.PostAsJsonAsync($"/api/projects/{tenantAProjectId}/submittals", new PmUpsertRequest(
            Title: "Tenant A submittal"));
        submittalResp.EnsureSuccessStatusCode();
        var submittalId = await ReadIdAsync(submittalResp);

        var (tenantBClient, _, _) = await CreateAuthenticatedClientAsync();
        var crossTenantGet = await tenantBClient.GetAsync($"/api/projects/{tenantAProjectId}/submittals/{submittalId}");
        Assert.Equal(HttpStatusCode.NotFound, crossTenantGet.StatusCode);

        var projectB = await CreateProjectAsync(tenantAClient, "Submittal-ProjectB");
        var wrongProjectWorkflow = await tenantAClient.PostAsJsonAsync($"/api/projects/{projectB}/submittals/{submittalId}/workflow", new PmUpsertRequest(
            Title: "Wrong route"));
        Assert.Equal(HttpStatusCode.NotFound, wrongProjectWorkflow.StatusCode);
    }
}
