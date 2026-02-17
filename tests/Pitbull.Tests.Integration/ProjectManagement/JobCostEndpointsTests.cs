using System.Net;
using System.Net.Http.Json;
using Pitbull.ProjectManagement.Features;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.ProjectManagement;

[Collection(DatabaseCollection.Name)]
public sealed class JobCostEndpointsTests(PostgresFixture db) : ApiIntegrationTestBase(db)
{
    [Fact]
    public async Task Get_budgets_without_auth_returns_401()
    {
        await Db.ResetAsync();
        using var client = Factory.CreateClient();

        var resp = await client.GetAsync($"/api/projects/{Guid.NewGuid()}/job-cost/budgets");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Can_create_budget_commitment_forecast_and_list()
    {
        await Db.ResetAsync();
        var (client, auth, tenantId) = await CreateAuthenticatedClientAsync();
        var projectId = await CreateProjectAsync(client, "JobCost");
        var costCodeId = await CreateCostCodeAsync(tenantId, auth.UserId, "JC1");

        var budgetResp = await client.PostAsJsonAsync($"/api/projects/{projectId}/job-cost/budgets", new PmUpsertRequest(
            Name: "Concrete Budget",
            Data: new Dictionary<string, object?>
            {
                ["CostCodeId"] = costCodeId,
                ["OriginalBudget"] = 10000m,
                ["ApprovedBudgetChanges"] = 2500m
            }));
        budgetResp.EnsureSuccessStatusCode();

        var forecastResp = await client.PostAsJsonAsync($"/api/projects/{projectId}/job-cost/forecasts", new PmUpsertRequest(
            Name: "Concrete Forecast",
            Data: new Dictionary<string, object?>
            {
                ["CostCodeId"] = costCodeId,
                ["EstimatedFinalCost"] = 14000m,
                ["ConfidenceLevel"] = "High"
            }));
        forecastResp.EnsureSuccessStatusCode();

        var rebuildResp = await client.PostAsync($"/api/projects/{projectId}/job-cost/actuals/rebuild", null);
        rebuildResp.EnsureSuccessStatusCode();

        var listBudgetsResp = await client.GetAsync($"/api/projects/{projectId}/job-cost/budgets?page=1&pageSize=20");
        listBudgetsResp.EnsureSuccessStatusCode();

        var listForecastsResp = await client.GetAsync($"/api/projects/{projectId}/job-cost/forecasts?page=1&pageSize=20");
        listForecastsResp.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Update_budget_from_other_project_returns_404()
    {
        await Db.ResetAsync();
        var (client, auth, tenantId) = await CreateAuthenticatedClientAsync();
        var projectA = await CreateProjectAsync(client, "Budget-A");
        var projectB = await CreateProjectAsync(client, "Budget-B");
        var costCodeId = await CreateCostCodeAsync(tenantId, auth.UserId, "JC2");

        var budgetResp = await client.PostAsJsonAsync($"/api/projects/{projectA}/job-cost/budgets", new PmUpsertRequest(
            Name: "Electrical",
            Data: new Dictionary<string, object?>
            {
                ["CostCodeId"] = costCodeId,
                ["OriginalBudget"] = 5000m,
                ["ApprovedBudgetChanges"] = 100m
            }));
        budgetResp.EnsureSuccessStatusCode();
        var budgetId = await ReadIdAsync(budgetResp);

        var wrongProjectUpdate = await client.PutAsJsonAsync($"/api/projects/{projectB}/job-cost/budgets/{budgetId}", new PmUpsertRequest(
            Name: "Updated Budget"));

        Assert.Equal(HttpStatusCode.NotFound, wrongProjectUpdate.StatusCode);
    }
}
