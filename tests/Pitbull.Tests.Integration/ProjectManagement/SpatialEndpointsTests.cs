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
        Assert.Contains(overlay.Nodes ?? [], n => n.Band != "InsufficientData");
        Assert.Contains(overlay.Nodes ?? [], n => n.Band == "InsufficientData");
    }

    [Fact]
    public async Task Zone_detail_lists_linked_rfis_and_honest_empty_for_unlinked()
    {
        await Db.ResetAsync();
        var (client, _, _) = await CreateAuthenticatedClientAsync();
        var projectId = await CreateProjectAsync(client, "Twin-Detail");

        var seedResp = await client.PostAsync($"/api/projects/{projectId}/spatial/graph/ensure-seeded", null);
        seedResp.EnsureSuccessStatusCode();
        var graph = await seedResp.Content.ReadFromJsonAsync<GraphDto>(JsonOpts);
        Assert.NotNull(graph?.Nodes);

        var east = graph.Nodes!.First(n => n.Code == "L1-EAST");
        var mech = graph.Nodes!.First(n => n.Code == "L2-MECH");

        var eastResp = await client.GetAsync($"/api/projects/{projectId}/spatial/zones/{east.Id}");
        eastResp.EnsureSuccessStatusCode();
        var eastDetail = await eastResp.Content.ReadFromJsonAsync<ZoneDetailDto>(JsonOpts);
        Assert.NotNull(eastDetail);
        Assert.Equal(east.Id, eastDetail.SpatialNodeId);
        Assert.NotEmpty(eastDetail.OpenRfis ?? []);
        Assert.Contains("Linked", eastDetail.Message ?? "", StringComparison.OrdinalIgnoreCase);

        var mechResp = await client.GetAsync($"/api/projects/{projectId}/spatial/zones/{mech.Id}");
        mechResp.EnsureSuccessStatusCode();
        var mechDetail = await mechResp.Content.ReadFromJsonAsync<ZoneDetailDto>(JsonOpts);
        Assert.NotNull(mechDetail);
        Assert.Empty(mechDetail.OpenRfis ?? []);
        Assert.Empty(mechDetail.DailyReports ?? []);
        Assert.Empty(mechDetail.PlanSheets ?? []);
        Assert.Contains("No linked", mechDetail.Message ?? "", StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Overlay_storey_filter_scopes_to_L1_zones_only()
    {
        await Db.ResetAsync();
        var (client, _, _) = await CreateAuthenticatedClientAsync();
        var projectId = await CreateProjectAsync(client, "Twin-Filter");

        var seedResp = await client.PostAsync($"/api/projects/{projectId}/spatial/graph/ensure-seeded", null);
        seedResp.EnsureSuccessStatusCode();
        var graph = await seedResp.Content.ReadFromJsonAsync<GraphDto>(JsonOpts);
        Assert.NotNull(graph?.Nodes);

        var l1 = graph.Nodes!.First(n => n.Code == "L1" && string.Equals(n.NodeType, "Storey", StringComparison.OrdinalIgnoreCase));
        var east = graph.Nodes!.First(n => n.Code == "L1-EAST");
        var deck = graph.Nodes!.First(n => n.Code == "L2-DECK");

        var filtered = await client.GetAsync(
            $"/api/projects/{projectId}/spatial/overlays?mode=rfi&storeyNodeId={l1.Id}");
        filtered.EnsureSuccessStatusCode();
        var overlay = await filtered.Content.ReadFromJsonAsync<OverlayDto>(JsonOpts);
        Assert.NotNull(overlay);

        var zoneNodeIds = overlay.Nodes!
            .Where(n => graph.Nodes!.Any(g =>
                g.Id == n.SpatialNodeId
                && string.Equals(g.NodeType, "Zone", StringComparison.OrdinalIgnoreCase)))
            .Select(n => n.SpatialNodeId)
            .ToHashSet();

        Assert.Contains(east.Id, zoneNodeIds);
        Assert.DoesNotContain(deck.Id, zoneNodeIds);
    }

    [Fact]
    public async Task Overlay_asof_query_returns_truth_note_with_asof_date()
    {
        await Db.ResetAsync();
        var (client, _, _) = await CreateAuthenticatedClientAsync();
        var projectId = await CreateProjectAsync(client, "Twin-AsOf");

        await client.PostAsync($"/api/projects/{projectId}/spatial/graph/ensure-seeded", null);

        var asOf = "2026-07-01";
        var resp = await client.GetAsync(
            $"/api/projects/{projectId}/spatial/overlays?mode=progress&asOf={asOf}");
        resp.EnsureSuccessStatusCode();
        var overlay = await resp.Content.ReadFromJsonAsync<OverlayDto>(JsonOpts);
        Assert.NotNull(overlay);
        Assert.Equal(asOf, overlay.AsOf);
        Assert.True(overlay.HasGraph);
    }

    [Fact]
    public async Task Zone_detail_unknown_node_returns_not_found()
    {
        await Db.ResetAsync();
        var (client, _, _) = await CreateAuthenticatedClientAsync();
        var projectId = await CreateProjectAsync(client, "Twin-Missing-Zone");

        await client.PostAsync($"/api/projects/{projectId}/spatial/graph/ensure-seeded", null);

        var resp = await client.GetAsync($"/api/projects/{projectId}/spatial/zones/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Unknown_project_spatial_graph_is_denied_or_not_found()
    {
        await Db.ResetAsync();
        var (client, _, _) = await CreateAuthenticatedClientAsync();
        var projectId = await CreateProjectAsync(client, "Twin-Own");
        await client.PostAsync($"/api/projects/{projectId}/spatial/graph/ensure-seeded", null);

        // Unknown project id must not return a success graph payload (404 or 403 both ok)
        var foreignProject = Guid.NewGuid();
        var resp = await client.GetAsync($"/api/projects/{foreignProject}/spatial/graph");
        Assert.True(
            resp.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Forbidden,
            $"Expected 404/403 for unknown project, got {(int)resp.StatusCode}");

        var own = await client.GetAsync($"/api/projects/{projectId}/spatial/graph");
        own.EnsureSuccessStatusCode();
        var graph = await own.Content.ReadFromJsonAsync<GraphDto>(JsonOpts);
        Assert.NotNull(graph);
        Assert.True(graph.HasGraph);
    }

    /// <summary>2.16.0 — photo-pins + zone detail: honest empty, no fake green pins.</summary>
    [Fact]
    public async Task Photo_pins_empty_is_honest_and_zone_filter_scopes()
    {
        await Db.ResetAsync();
        var (client, _, _) = await CreateAuthenticatedClientAsync();
        var projectId = await CreateProjectAsync(client, "Twin-Photo-Pins");

        var seedResp = await client.PostAsync($"/api/projects/{projectId}/spatial/graph/ensure-seeded", null);
        seedResp.EnsureSuccessStatusCode();
        var graph = await seedResp.Content.ReadFromJsonAsync<GraphDto>(JsonOpts);
        Assert.NotNull(graph?.Nodes);
        var east = graph.Nodes!.First(n => n.Code == "L1-EAST");

        // Project-wide pins: no GPS/zone photos yet → honest empty (not all-clear).
        var pinsResp = await client.GetAsync($"/api/projects/{projectId}/spatial/photo-pins");
        pinsResp.EnsureSuccessStatusCode();
        var pins = await pinsResp.Content.ReadFromJsonAsync<PhotoPinsDto>(JsonOpts);
        Assert.NotNull(pins);
        Assert.Equal(projectId, pins.ProjectId);
        Assert.Empty(pins.Pins ?? []);
        Assert.Contains("No photo pins", pins.Message ?? "", StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("all clear", pins.Message ?? "", StringComparison.OrdinalIgnoreCase);

        // Zone-scoped pins still empty and bind SpatialNodeId.
        var zonePinsResp = await client.GetAsync(
            $"/api/projects/{projectId}/spatial/photo-pins?spatialNodeId={east.Id}");
        zonePinsResp.EnsureSuccessStatusCode();
        var zonePins = await zonePinsResp.Content.ReadFromJsonAsync<PhotoPinsDto>(JsonOpts);
        Assert.NotNull(zonePins);
        Assert.Equal(east.Id, zonePins.SpatialNodeId);
        Assert.Empty(zonePins.Pins ?? []);

        // Zone detail still works alongside photo-pins (integration of zone + photos surfaces).
        var detailResp = await client.GetAsync($"/api/projects/{projectId}/spatial/zones/{east.Id}");
        detailResp.EnsureSuccessStatusCode();
        var detail = await detailResp.Content.ReadFromJsonAsync<ZoneDetailDto>(JsonOpts);
        Assert.NotNull(detail);
        Assert.Equal(east.Id, detail.SpatialNodeId);
    }

    [Fact]
    public async Task Photo_pins_without_auth_returns_401()
    {
        await Db.ResetAsync();
        using var client = Factory.CreateClient();
        var resp = await client.GetAsync($"/api/projects/{Guid.NewGuid()}/spatial/photo-pins");
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
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
        string? AsOf,
        string TruthNote,
        List<OverlayNodeDto>? Nodes);

    private sealed record OverlayNodeDto(
        Guid SpatialNodeId,
        string Band,
        string Label,
        bool IsProxy);

    private sealed record ZoneDetailDto(
        Guid SpatialNodeId,
        string Code,
        string Name,
        string Message,
        List<LinkedDto>? OpenRfis,
        List<LinkedDto>? DailyReports,
        List<LinkedDto>? ProgressEntries,
        List<LinkedDto>? ScheduleActivities,
        List<LinkedDto>? PlanSheets);

    private sealed record LinkedDto(Guid Id, string Kind, string Title);

    private sealed record PhotoPinsDto(
        Guid ProjectId,
        Guid? SpatialNodeId,
        string Message,
        List<PhotoPinDto>? Pins);

    private sealed record PhotoPinDto(
        Guid PhotoId,
        Guid? SpatialNodeId,
        double? Latitude,
        double? Longitude,
        string? ThumbnailUrl,
        string PlacementSource);
}
