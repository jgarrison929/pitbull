using System.Net;
using System.Net.Http.Json;
using Pitbull.ProjectManagement.Features;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.ProjectManagement;

[Collection(DatabaseCollection.Name)]
public sealed class ScheduleEndpointsTests(PostgresFixture db) : ApiIntegrationTestBase(db)
{
    [Fact]
    public async Task Get_schedules_without_auth_returns_401()
    {
        await Db.ResetAsync();
        using var client = Factory.CreateClient();

        var resp = await client.GetAsync($"/api/projects/{Guid.NewGuid()}/schedules");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Can_create_schedule_activities_and_dependency_with_milestone()
    {
        await Db.ResetAsync();
        var (client, _, _) = await CreateAuthenticatedClientAsync();
        var projectId = await CreateProjectAsync(client, "Schedule");

        var createScheduleResp = await client.PostAsJsonAsync($"/api/projects/{projectId}/schedules", new PmUpsertRequest(
            Name: "Master Schedule",
            Status: "Draft",
            Data: new Dictionary<string, object?> { ["DataDate"] = DateTime.UtcNow }));
        createScheduleResp.EnsureSuccessStatusCode();
        var scheduleId = await ReadIdAsync(createScheduleResp);

        var addActivityResp = await client.PostAsJsonAsync($"/api/projects/{projectId}/schedules/{scheduleId}/activities", new PmUpsertRequest(
            Name: "Mobilization",
            Status: "NotStarted",
            Data: new Dictionary<string, object?>
            {
                ["ActivityCode"] = "ACT-001",
                ["ActivityType"] = "Task",
                ["OriginalDurationDays"] = 5,
                ["RemainingDurationDays"] = 5
            }));
        addActivityResp.EnsureSuccessStatusCode();
        var activityId = await ReadIdAsync(addActivityResp);

        var addMilestoneResp = await client.PostAsJsonAsync($"/api/projects/{projectId}/schedules/{scheduleId}/activities", new PmUpsertRequest(
            Name: "NTP Milestone",
            Status: "NotStarted",
            Data: new Dictionary<string, object?>
            {
                ["ActivityCode"] = "ACT-002",
                ["ActivityType"] = "Milestone",
                ["OriginalDurationDays"] = 0,
                ["RemainingDurationDays"] = 0
            }));
        addMilestoneResp.EnsureSuccessStatusCode();
        var milestoneId = await ReadIdAsync(addMilestoneResp);

        var addDependencyResp = await client.PostAsJsonAsync($"/api/projects/{projectId}/schedules/{scheduleId}/dependencies", new PmUpsertRequest(
            Data: new Dictionary<string, object?>
            {
                ["PredecessorActivityId"] = activityId,
                ["SuccessorActivityId"] = milestoneId,
                ["DependencyType"] = "FS",
                ["LagDays"] = 0
            }));
        addDependencyResp.EnsureSuccessStatusCode();

        var dependencyId = await ReadIdAsync(addDependencyResp);
        Assert.NotEqual(Guid.Empty, dependencyId);
    }

    [Fact]
    public async Task Add_dependency_with_activity_from_other_project_returns_400()
    {
        await Db.ResetAsync();
        var (client, _, _) = await CreateAuthenticatedClientAsync();

        var projectA = await CreateProjectAsync(client, "Sched-A");
        var projectB = await CreateProjectAsync(client, "Sched-B");

        var scheduleAResp = await client.PostAsJsonAsync($"/api/projects/{projectA}/schedules", new PmUpsertRequest(Name: "Schedule A"));
        scheduleAResp.EnsureSuccessStatusCode();
        var scheduleAId = await ReadIdAsync(scheduleAResp);

        var scheduleBResp = await client.PostAsJsonAsync($"/api/projects/{projectB}/schedules", new PmUpsertRequest(Name: "Schedule B"));
        scheduleBResp.EnsureSuccessStatusCode();
        var scheduleBId = await ReadIdAsync(scheduleBResp);

        var activityAResp = await client.PostAsJsonAsync($"/api/projects/{projectA}/schedules/{scheduleAId}/activities", new PmUpsertRequest(Name: "A1"));
        activityAResp.EnsureSuccessStatusCode();
        var activityAId = await ReadIdAsync(activityAResp);

        var activityBResp = await client.PostAsJsonAsync($"/api/projects/{projectB}/schedules/{scheduleBId}/activities", new PmUpsertRequest(Name: "B1"));
        activityBResp.EnsureSuccessStatusCode();
        var activityBId = await ReadIdAsync(activityBResp);

        var badResp = await client.PostAsJsonAsync($"/api/projects/{projectB}/schedules/{scheduleBId}/dependencies", new PmUpsertRequest(
            Data: new Dictionary<string, object?>
            {
                ["PredecessorActivityId"] = activityAId,
                ["SuccessorActivityId"] = activityBId
            }));

        Assert.Equal(HttpStatusCode.BadRequest, badResp.StatusCode);
        var body = await ReadBodyAsync(badResp);
        Assert.Contains("VALIDATION_ERROR", body);
    }
}
