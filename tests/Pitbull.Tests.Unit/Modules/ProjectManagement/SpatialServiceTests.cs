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
    public async Task Overlay_without_zone_links_is_insufficient_not_green()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        await service.EnsureSeededGraphAsync(ProjectId);

        var overlay = await service.GetOverlayAsync(ProjectId, SpatialOverlayCalculator.ModeRfi);

        overlay.IsSuccess.Should().BeTrue();
        overlay.Value!.HasGraph.Should().BeTrue();
        overlay.Value.TruthNote.Should().Contain("proxies");
        overlay.Value.Nodes.Should().OnlyContain(n =>
            n.Band == nameof(SpatialOverlayCalculator.OverlayBand.InsufficientData));
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
}
