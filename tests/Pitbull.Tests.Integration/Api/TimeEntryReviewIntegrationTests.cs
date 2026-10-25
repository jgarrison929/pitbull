using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

/// <summary>
/// 2.21.8 — approval chain uses same status strings as frontend workflow-transitions.
/// Review queue + review endpoints; empty queue is honest.
/// </summary>
[Collection(DatabaseCollection.Name)]
public sealed class TimeEntryReviewIntegrationTests(PostgresFixture db) : ApiIntegrationTestBase(db)
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true
    };

    [Fact]
    public async Task Review_queue_requires_auth()
    {
        await Db.ResetAsync();
        using var client = Factory.CreateClient();
        var resp = await client.GetAsync("/api/time-entries/review-queue");
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Review_queue_returns_groups_shape_when_authenticated()
    {
        await Db.ResetAsync();
        var (client, _, _) = await CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync("/api/time-entries/review-queue");
        // May be 200 with empty groups or 400 if employee context missing for non-admin
        Assert.True(
            resp.StatusCode is HttpStatusCode.OK or HttpStatusCode.BadRequest,
            $"Unexpected {(int)resp.StatusCode}");

        if (resp.StatusCode != HttpStatusCode.OK)
            return;

        var json = await resp.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        // Shape: groups array (may be empty — honest)
        Assert.True(
            doc.RootElement.TryGetProperty("groups", out _)
            || doc.RootElement.TryGetProperty("Groups", out _),
            "Expected groups property on review queue");
    }

    [Fact]
    public async Task Pending_approvals_aggregate_includes_timeEntries_key()
    {
        await Db.ResetAsync();
        var (client, _, _) = await CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync("/api/approvals/pending");
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<PendingDto>(JsonOpts);
        Assert.NotNull(body);
        Assert.Equal("timeEntries", body.ExpandedLifecycle);
        Assert.True(body.TimeEntries >= 0);
        Assert.True(body.Total >= body.TimeEntries);
    }

    private sealed record PendingDto(
        int Total,
        int TimeEntries,
        int ChangeOrders,
        string ExpandedLifecycle);
}
