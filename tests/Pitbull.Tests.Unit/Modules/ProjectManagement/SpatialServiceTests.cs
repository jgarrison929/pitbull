using FluentAssertions;
using Pitbull.Core.MultiTenancy;
using Pitbull.ProjectManagement.Domain;
using Pitbull.ProjectManagement.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Modules.ProjectManagement;

public sealed class SpatialServiceTests
{
    private static readonly Guid ProjectId = Guid.NewGuid();

    private static SpatialService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        var companyContext = new CompanyContext
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            CompanyCode = "01",
            CompanyName = "Test Company"
        };
        return new SpatialService(db, companyContext);
    }

    [Fact]
    public async Task GetGraph_missing_project_returns_not_found()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.GetGraphAsync(Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task GetGraph_no_seed_returns_honest_empty()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.GetGraphAsync(ProjectId);

        result.IsSuccess.Should().BeTrue();
        result.Value!.HasGraph.Should().BeFalse();
        result.Value.Message.Should().Contain("No published spatial graph");
        result.Value.Nodes.Should().BeEmpty();
    }

    [Fact]
    public async Task EnsureSeeded_creates_site_building_storey_zones()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.EnsureSeededGraphAsync(ProjectId);

        result.IsSuccess.Should().BeTrue();
        result.Value!.HasGraph.Should().BeTrue();
        result.Value.Nodes.Should().NotBeEmpty();
        result.Value.Nodes.Count(n => n.NodeType == "Zone").Should().Be(4);
        result.Value.Nodes.Any(n => n.NodeType == "Site").Should().BeTrue();
        result.Value.Nodes.Any(n => n.NodeType == "Building").Should().BeTrue();
        result.Value.Nodes.Any(n => n.NodeType == "Storey").Should().BeTrue();
    }

    [Fact]
    public async Task EnsureSeeded_is_idempotent()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var first = await service.EnsureSeededGraphAsync(ProjectId);
        var second = await service.EnsureSeededGraphAsync(ProjectId);

        first.Value!.GraphId.Should().Be(second.Value!.GraphId);
        db.Set<SpatialGraph>().Count().Should().Be(1);
    }

    [Fact]
    public async Task Overlay_seed_fixture_paints_linked_rfi_zones_not_all_insufficient()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        await service.EnsureSeededGraphAsync(ProjectId);

        var overlay = await service.GetOverlayAsync(ProjectId, SpatialOverlayCalculator.ModeRfi);

        overlay.IsSuccess.Should().BeTrue();
        overlay.Value!.HasGraph.Should().BeTrue();
        overlay.Value.TruthNote.Should().Contain("proxies");

        var graph = (await service.GetGraphAsync(ProjectId)).Value!;
        var east = graph.Nodes.First(n => n.Code == "L1-EAST");
        var mech = graph.Nodes.First(n => n.Code == "L2-MECH");
        var eastOv = overlay.Value.Nodes.First(n => n.SpatialNodeId == east.Id);
        var mechOv = overlay.Value.Nodes.First(n => n.SpatialNodeId == mech.Id);

        // 3 open seed RFIs on L1-EAST → Risk; L2-MECH unlinked → Insufficient (not green)
        eastOv.Band.Should().Be(nameof(SpatialOverlayCalculator.OverlayBand.Risk));
        mechOv.Band.Should().Be(nameof(SpatialOverlayCalculator.OverlayBand.InsufficientData));
        overlay.Value.Nodes.Should().Contain(n =>
            n.Band != nameof(SpatialOverlayCalculator.OverlayBand.InsufficientData));
    }

    [Fact]
    public async Task Overlay_seed_progress_mode_paints_linked_zone()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        await service.EnsureSeededGraphAsync(ProjectId);

        var overlay = await service.GetOverlayAsync(ProjectId, SpatialOverlayCalculator.ModeProgress);
        var graph = (await service.GetGraphAsync(ProjectId)).Value!;
        var west = graph.Nodes.First(n => n.Code == "L1-WEST");
        var westOv = overlay.Value!.Nodes.First(n => n.SpatialNodeId == west.Id);

        westOv.Band.Should().Be(nameof(SpatialOverlayCalculator.OverlayBand.OnTrack));
        westOv.Label.Should().Contain("%");
    }

    [Fact]
    public async Task Overlay_no_graph_returns_empty_with_truth_note()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var overlay = await service.GetOverlayAsync(ProjectId, "progress");

        overlay.IsSuccess.Should().BeTrue();
        overlay.Value!.HasGraph.Should().BeFalse();
        overlay.Value.Nodes.Should().BeEmpty();
        overlay.Value.TruthNote.Should().Contain("not green");
    }

    [Fact]
    public async Task ListZones_returns_path_labels_after_seed()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        await service.EnsureSeededGraphAsync(ProjectId);

        var zones = await service.ListZonesAsync(ProjectId);

        zones.IsSuccess.Should().BeTrue();
        zones.Value!.Should().HaveCount(4);
        zones.Value.Should().OnlyContain(z => z.PathLabel.Contains('/'));
    }

    [Fact]
    public async Task ZoneDetail_linked_zone_lists_rfis_unlinked_is_honest_empty()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        await service.EnsureSeededGraphAsync(ProjectId);
        var graph = (await service.GetGraphAsync(ProjectId)).Value!;
        var east = graph.Nodes.First(n => n.Code == "L1-EAST");
        var mech = graph.Nodes.First(n => n.Code == "L2-MECH");

        var eastDetail = await service.GetZoneDetailAsync(ProjectId, east.Id);
        var mechDetail = await service.GetZoneDetailAsync(ProjectId, mech.Id);

        eastDetail.IsSuccess.Should().BeTrue();
        eastDetail.Value!.OpenRfis.Should().NotBeEmpty();
        eastDetail.Value.Message.Should().Contain("Linked");

        mechDetail.IsSuccess.Should().BeTrue();
        mechDetail.Value!.OpenRfis.Should().BeEmpty();
        mechDetail.Value.DailyReports.Should().BeEmpty();
        mechDetail.Value.PlanSheets.Should().BeEmpty();
        mechDetail.Value.Message.Should().Contain("No linked");
    }
}
