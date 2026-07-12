using Pitbull.ProjectManagement.Features;

namespace Pitbull.Tests.Unit.Modules.Spatial;

/// <summary>2.15.3 — photo pin aggregation never invents green pins or GPS.</summary>
public class TwinPhotoPinAggregationTests
{
    [Fact]
    public void Empty_response_has_zero_pins_and_honest_message()
    {
        var projectId = Guid.NewGuid();
        var empty = TwinPhotoPinAggregation.Empty(projectId);
        Assert.Empty(empty.Pins);
        Assert.Equal(projectId, empty.ProjectId);
        Assert.Contains("No photo pins", empty.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("all clear", empty.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Aggregate_skips_photos_without_gps_or_zone()
    {
        var photoId = Guid.NewGuid();
        var pins = TwinPhotoPinAggregation.Aggregate(new[]
        {
            (photoId, (Guid?)null, (double?)null, (double?)null, (string?)null, (DateTime?)null),
        });
        Assert.Empty(pins);
    }

    [Fact]
    public void Aggregate_places_gps_pin_without_inventing_zone()
    {
        var photoId = Guid.NewGuid();
        var pins = TwinPhotoPinAggregation.Aggregate(new[]
        {
            (photoId, (Guid?)null, (double?)30.27, (double?)-97.74, (string?)"thumb.jpg", (DateTime?)DateTime.UtcNow),
        });
        Assert.Single(pins);
        Assert.Equal("gps", pins[0].PlacementSource);
        Assert.Equal(30.27, pins[0].Latitude);
        Assert.Null(pins[0].SpatialNodeId);
    }

    [Fact]
    public void Aggregate_filters_by_zone_when_requested()
    {
        var zoneA = Guid.NewGuid();
        var zoneB = Guid.NewGuid();
        var pins = TwinPhotoPinAggregation.Aggregate(
            new[]
            {
                (Guid.NewGuid(), (Guid?)zoneA, (double?)null, (double?)null, (string?)null, (DateTime?)null),
                (Guid.NewGuid(), (Guid?)zoneB, (double?)null, (double?)null, (string?)null, (DateTime?)null),
            },
            filterZoneId: zoneA);
        Assert.Single(pins);
        Assert.Equal(zoneA, pins[0].SpatialNodeId);
        Assert.Equal("zone", pins[0].PlacementSource);
    }
}
