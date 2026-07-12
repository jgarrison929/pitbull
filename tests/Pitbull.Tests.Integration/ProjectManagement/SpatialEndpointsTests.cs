using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.ProjectManagement;

[Collection(DatabaseCollection.Name)]
public sealed class SpatialEndpointsTests(PostgresFixture db) : ApiIntegrationTestBase(db)
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true
    };

    [Fact]
    public async Task Get_graph_without_auth_returns_401()
    {
        await Db.ResetAsync();
        using var client = Factory.CreateClient();

        var resp = await client.GetAsync($"/api/projects/{Guid.NewGuid()}/spatial/graph");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Get_graph_missing_project_returns_not_found()
    {
        await Db.ResetAsync();
        var (client, _, _) = await CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync($"/api/projects/{Guid.NewGuid()}/spatial/graph");

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Graph_empty_then_seed_then_zones_and_overlay()
    {
        await Db.ResetAsync();
        var (client, _, _) = await CreateAuthenticatedClientAsync();
        var projectId = await CreateProjectAsync(client, "Twin-Spatial");

        var emptyResp = await client.GetAsync($"/api/projects/{projectId}/spatial/graph");
        emptyResp.EnsureSuccessStatusCode();
        var empty = await emptyResp.Content.ReadFromJsonAsync<GraphDto>(JsonOpts);
        Assert.NotNull(empty);
        Assert.False(empty.HasGraph);
        Assert.NotNull(empty.Message);
        Assert.Empty(empty.Nodes ?? []);

        var seedResp = await client.PostAsync($"/api/projects/{projectId}/spatial/graph/ensure-seeded", null);
        seedResp.EnsureSuccessStatusCode();
        var seeded = await seedResp.Content.ReadFromJsonAsync<GraphDto>(JsonOpts);
        Assert.NotNull(seeded);
        Assert.True(seeded.HasGraph);
        Assert.NotEmpty(seeded.Nodes ?? []);
        Assert.Contains(seeded.Nodes!, n => string.Equals(n.NodeType, "Zone", StringComparison.OrdinalIgnoreCase));

        var zonesResp = await client.GetAsync($"/api/projects/{projectId}/spatial/zones");
        zonesResp.EnsureSuccessStatusCode();
        var zones = await zonesResp.Content.ReadFromJsonAsync<List<ZoneDto>>(JsonOpts);
        Assert.NotNull(zones);
        Assert.True(zones.Count >= 1);

        var overlayResp = await client.GetAsync($"/api/projects/{projectId}/spatial/overlays?mode=rfi");
        overlayResp.EnsureSuccessStatusCode();
        var overlay = await overlayResp.Content.ReadFromJsonAsync<OverlayDto>(JsonOpts);
        Assert.NotNull(overlay);
        Assert.True(overlay.HasGraph);
        Assert.Contains("prox", overlay.TruthNote ?? "", StringComparison.OrdinalIgnoreCase);
        // No zone-linked RFIs yet → honest insufficient, never default green
        Assert.All(overlay.Nodes ?? [], n =>
            Assert.Equal("InsufficientData", n.Band));
    }

    private sealed record GraphDto(
        bool HasGraph,
        string? Message,
        Guid? GraphId,
        List<NodeDto>? Nodes);

    private sealed record NodeDto(Guid Id, string NodeType, string Code, string Name);

    private sealed record ZoneDto(Guid Id, string Code, string Name, string PathLabel);

    private sealed record OverlayDto(
        bool HasGraph,
        string? Message,
        string Mode,
        string TruthNote,
        List<OverlayNodeDto>? Nodes);

    private sealed record OverlayNodeDto(
        Guid SpatialNodeId,
        string Band,
        string Label,
        bool IsProxy);
}
