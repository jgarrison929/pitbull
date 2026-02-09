using System.Net;
using System.Net.Http.Json;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class AdminAuditEndpointsTests(PostgresFixture db) : IAsyncLifetime
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
    public async Task List_audit_logs_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/admin/audit-logs");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task List_audit_logs_returns_empty_list_for_admin()
    {
        await db.ResetAsync();

        // First user is auto-promoted to Admin
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync("/api/admin/audit-logs");
        
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        // Should return paginated response with empty items
        Assert.Contains("\"items\":", json);
        Assert.Contains("\"totalCount\":", json);
        Assert.Contains("\"page\":", json);
        Assert.Contains("\"pageSize\":", json);
    }

    [Fact]
    public async Task List_audit_logs_supports_pagination()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync("/api/admin/audit-logs?page=2&pageSize=25");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        Assert.Contains("\"page\":2", json);
        Assert.Contains("\"pageSize\":25", json);
    }

    [Fact]
    public async Task List_audit_logs_supports_filters()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Test with all filter parameters
        var userId = Guid.NewGuid();
        var from = DateTime.UtcNow.AddDays(-30).ToString("o");
        var to = DateTime.UtcNow.ToString("o");

        var resp = await client.GetAsync(
            $"/api/admin/audit-logs?userId={userId}&action=Create&resourceType=Project&from={from}&to={to}&success=true");
        
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task Get_resource_types_returns_list()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync("/api/admin/audit-logs/resource-types");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var types = await resp.Content.ReadFromJsonAsync<List<string>>();
        Assert.NotNull(types);
        Assert.NotEmpty(types);
        Assert.Contains("Project", types);
        Assert.Contains("Employee", types);
    }

    [Fact]
    public async Task Get_actions_returns_audit_action_enum_values()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync("/api/admin/audit-logs/actions");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var actions = await resp.Content.ReadFromJsonAsync<List<string>>();
        Assert.NotNull(actions);
        Assert.NotEmpty(actions);
        // Should contain standard audit actions
        Assert.Contains("Create", actions);
        Assert.Contains("Update", actions);
        Assert.Contains("Delete", actions);
    }
}
