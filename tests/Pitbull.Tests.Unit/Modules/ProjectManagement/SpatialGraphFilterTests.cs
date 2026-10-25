using FluentAssertions;
using Pitbull.ProjectManagement.Domain;

namespace Pitbull.Tests.Unit.Modules.ProjectManagement;

public sealed class SpatialGraphFilterTests
{
    private static readonly Guid Site = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000001");
    private static readonly Guid Bld = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000002");
    private static readonly Guid L1 = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000003");
    private static readonly Guid L2 = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000004");
    private static readonly Guid East = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000005");
    private static readonly Guid West = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000006");
    private static readonly Guid Deck = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000007");

    private static List<SpatialGraphFilter.NodeRef> Tree() =>
    [
        new(Site, null, "Site", "SITE"),
        new(Bld, Site, "Building", "BLDG"),
        new(L1, Bld, "Storey", "L1"),
        new(L2, Bld, "Storey", "L2"),
        new(East, L1, "Zone", "L1-EAST"),
        new(West, L1, "Zone", "L1-WEST"),
        new(Deck, L2, "Zone", "L2-DECK"),
    ];

    [Fact]
    public void ZoneIdsUnderStorey_null_returns_all_zones()
    {
        var ids = SpatialGraphFilter.ZoneIdsUnderStorey(Tree(), null);
        ids.Should().BeEquivalentTo(new[] { East, West, Deck });
    }

    [Fact]
    public void ZoneIdsUnderStorey_L1_returns_only_L1_zones()
    {
        var ids = SpatialGraphFilter.ZoneIdsUnderStorey(Tree(), L1);
        ids.Should().BeEquivalentTo(new[] { East, West });
        ids.Should().NotContain(Deck);
    }

    [Fact]
    public void ZoneIdsUnderStorey_unknown_storey_returns_empty()
    {
        SpatialGraphFilter.ZoneIdsUnderStorey(Tree(), Guid.NewGuid()).Should().BeEmpty();
    }

    [Fact]
    public void DateInWindow_respects_bounds()
    {
        var d = new DateTime(2026, 7, 10, 0, 0, 0, DateTimeKind.Utc);
        SpatialGraphFilter.DateInWindow(d, null, null).Should().BeTrue();
        SpatialGraphFilter.DateInWindow(d, new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc), null).Should().BeTrue();
        SpatialGraphFilter.DateInWindow(d, new DateTime(2026, 7, 11, 0, 0, 0, DateTimeKind.Utc), null).Should().BeFalse();
        SpatialGraphFilter.DateInWindow(d, null, new DateTime(2026, 7, 9, 0, 0, 0, DateTimeKind.Utc)).Should().BeFalse();
        SpatialGraphFilter.DateInWindow(d, new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc), new DateTime(2026, 7, 15, 0, 0, 0, DateTimeKind.Utc)).Should().BeTrue();
    }
}
