using System.Net;
using System.Net.Http.Json;
using Pitbull.ProjectManagement.Features;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.ProjectManagement;

[Collection(DatabaseCollection.Name)]
public sealed class TasksEndpointsTests(PostgresFixture db) : ApiIntegrationTestBase(db)
{
    [Fact]
    public async Task Get_tasks_without_auth_returns_401()
    {
        await Db.ResetAsync();
        using var client = Factory.CreateClient();

        var resp = await client.GetAsync($"/api/projects/{Guid.NewGuid()}/tasks");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Can_create_update_complete_and_list_task()
    {
        await Db.ResetAsync();
        var (client, auth, _) = await CreateAuthenticatedClientAsync();
        var projectId = await CreateProjectAsync(client, "Task");

        var createResp = await client.PostAsJsonAsync($"/api/projects/{projectId}/tasks", new PmUpsertRequest(
            Title: "Inspect steel framing",
            Description: "Verify anchor bolts and plumbness",
            DueDate: DateTime.UtcNow.AddDays(-1),
            Status: "Open",
            Data: new Dictionary<string, object?>
            {
                ["TaskType"] = "General",
                ["Priority"] = "High",
                ["AssignedByUserId"] = auth.UserId
            }));
        createResp.EnsureSuccessStatusCode();
        var taskId = await ReadIdAsync(createResp);

        var listResp = await client.GetAsync($"/api/projects/{projectId}/tasks?page=1&pageSize=20");
        listResp.EnsureSuccessStatusCode();
        var listBody = await ReadBodyAsync(listResp);
        Assert.Contains(taskId.ToString(), listBody);

        var completeResp = await client.PutAsJsonAsync($"/api/projects/{projectId}/tasks/{taskId}", new PmUpsertRequest(
            Status: "Complete",
            Data: new Dictionary<string, object?> { ["CompletedAt"] = DateTime.UtcNow }));
        completeResp.EnsureSuccessStatusCode();

        var getResp = await client.GetAsync($"/api/projects/{projectId}/tasks/{taskId}");
        getResp.EnsureSuccessStatusCode();
        var getBody = await ReadBodyAsync(getResp);
        Assert.Contains("Complete", getBody);
    }

    [Fact]
    public async Task Add_comment_with_task_from_other_project_returns_404()
    {
        await Db.ResetAsync();
        var (client, auth, _) = await CreateAuthenticatedClientAsync();

        var projectA = await CreateProjectAsync(client, "Task-A");
        var projectB = await CreateProjectAsync(client, "Task-B");

        var taskResp = await client.PostAsJsonAsync($"/api/projects/{projectA}/tasks", new PmUpsertRequest(
            Title: "A task",
            Data: new Dictionary<string, object?>
            {
                ["TaskType"] = "General",
                ["Priority"] = "Normal",
                ["AssignedByUserId"] = auth.UserId
            }));
        taskResp.EnsureSuccessStatusCode();
        var taskId = await ReadIdAsync(taskResp);

        var badResp = await client.PostAsJsonAsync($"/api/projects/{projectB}/tasks/{taskId}/comments", new PmUpsertRequest(
            Data: new Dictionary<string, object?>
            {
                ["Comment"] = "Wrong project route",
                ["CommentedByUserId"] = auth.UserId,
                ["CommentedAt"] = DateTime.UtcNow
            }));

        Assert.Equal(HttpStatusCode.NotFound, badResp.StatusCode);
    }
}
