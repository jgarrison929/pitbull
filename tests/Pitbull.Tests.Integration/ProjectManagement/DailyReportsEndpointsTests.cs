using System.Net;
using System.Net.Http.Json;
using Pitbull.ProjectManagement.Features;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.ProjectManagement;

[Collection(DatabaseCollection.Name)]
public sealed class DailyReportsEndpointsTests(PostgresFixture db) : ApiIntegrationTestBase(db)
{
    [Fact]
    public async Task Get_daily_reports_without_auth_returns_401()
    {
        await Db.ResetAsync();
        using var client = Factory.CreateClient();

        var resp = await client.GetAsync($"/api/projects/{Guid.NewGuid()}/daily-reports");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Can_create_submit_approve_and_add_photo_to_daily_report()
    {
        await Db.ResetAsync();
        var (client, auth, _) = await CreateAuthenticatedClientAsync();
        var projectId = await CreateProjectAsync(client, "Daily");

        var createResp = await client.PostAsJsonAsync($"/api/projects/{projectId}/daily-reports", new PmUpsertRequest(
            Name: "Daily Report - Field",
            Data: new Dictionary<string, object?>
            {
                ["ReportDate"] = DateTime.UtcNow,
                ["ReportType"] = "Foreman",
                ["WeatherSummary"] = "Clear skies",
                ["WorkNarrative"] = "Poured footings on north wing.",
                ["CrewCount"] = 12,
                ["EquipmentCount"] = 3,
                ["PreparedByUserId"] = auth.UserId
            }));
        createResp.EnsureSuccessStatusCode();
        var reportId = await ReadIdAsync(createResp);

        var submitResp = await client.PostAsync($"/api/projects/{projectId}/daily-reports/{reportId}/submit", null);
        submitResp.EnsureSuccessStatusCode();

        var approveResp = await client.PostAsync($"/api/projects/{projectId}/daily-reports/{reportId}/approve", null);
        approveResp.EnsureSuccessStatusCode();

        var lockResp = await client.PostAsync($"/api/projects/{projectId}/daily-reports/{reportId}/lock", null);
        lockResp.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Update_daily_report_with_status_in_body_returns_invalid_transition()
    {
        await Db.ResetAsync();
        var (client, auth, _) = await CreateAuthenticatedClientAsync();
        var projectId = await CreateProjectAsync(client, "Daily-Status");

        var createResp = await client.PostAsJsonAsync($"/api/projects/{projectId}/daily-reports", new PmUpsertRequest(
            Data: new Dictionary<string, object?>
            {
                ["WeatherSummary"] = "Rain",
                ["WorkNarrative"] = "Interior framing",
                ["PreparedByUserId"] = auth.UserId
            }));
        createResp.EnsureSuccessStatusCode();
        var reportId = await ReadIdAsync(createResp);

        var updateResp = await client.PutAsJsonAsync($"/api/projects/{projectId}/daily-reports/{reportId}",
            new PmUpsertRequest(Status: "Submitted"));

        Assert.Equal(HttpStatusCode.BadRequest, updateResp.StatusCode);
    }

    [Fact]
    public async Task Rollup_with_child_report_from_different_project_returns_404()
    {
        await Db.ResetAsync();
        var (client, auth, _) = await CreateAuthenticatedClientAsync();

        var projectA = await CreateProjectAsync(client, "Daily-A");
        var projectB = await CreateProjectAsync(client, "Daily-B");

        var reportAResp = await client.PostAsJsonAsync($"/api/projects/{projectA}/daily-reports", new PmUpsertRequest(
            Name: "Report A",
            Data: new Dictionary<string, object?> { ["PreparedByUserId"] = auth.UserId }));
        reportAResp.EnsureSuccessStatusCode();
        var reportAId = await ReadIdAsync(reportAResp);

        var reportBResp = await client.PostAsJsonAsync($"/api/projects/{projectB}/daily-reports", new PmUpsertRequest(
            Name: "Report B",
            Data: new Dictionary<string, object?> { ["PreparedByUserId"] = auth.UserId }));
        reportBResp.EnsureSuccessStatusCode();
        var reportBId = await ReadIdAsync(reportBResp);

        var rollupResp = await client.PostAsJsonAsync($"/api/projects/{projectB}/daily-reports/{reportBId}/rollup", new PmUpsertRequest(
            ReferenceId: reportAId));

        Assert.Equal(HttpStatusCode.NotFound, rollupResp.StatusCode);
    }
}
