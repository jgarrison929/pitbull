using Pitbull.ProjectManagement.Features;

namespace Pitbull.Tests.Unit.Modules.Spatial;

/// <summary>2.15.3 + 2.15.9 — photo pin aggregation never invents green pins or GPS.</summary>
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

    [Fact]
    public void Aggregate_prefers_gps_source_when_zone_and_coords_present()
    {
        var zone = Guid.NewGuid();
        var photoId = Guid.NewGuid();
        var pins = TwinPhotoPinAggregation.Aggregate(new[]
        {
            (photoId, (Guid?)zone, (double?)40.0, (double?)-74.0, (string?)"/t.jpg", (DateTime?)null),
        });
        Assert.Single(pins);
        Assert.Equal("gps", pins[0].PlacementSource);
        Assert.Equal(zone, pins[0].SpatialNodeId);
        Assert.Equal(40.0, pins[0].Latitude);
        Assert.Equal(-74.0, pins[0].Longitude);
    }

    [Fact]
    public void Aggregate_partial_gps_only_lat_does_not_invent_longitude()
    {
        var zone = Guid.NewGuid();
        // Only latitude — not a valid GPS pair; zone still places pin without inventing lng.
        var pins = TwinPhotoPinAggregation.Aggregate(new[]
        {
            (Guid.NewGuid(), (Guid?)zone, (double?)30.0, (double?)null, (string?)null, (DateTime?)null),
        });
        Assert.Single(pins);
        Assert.Equal("zone", pins[0].PlacementSource);
        Assert.Null(pins[0].Latitude);
        Assert.Null(pins[0].Longitude);
    }

    [Fact]
    public void Aggregate_partial_gps_without_zone_is_skipped()
    {
        var pins = TwinPhotoPinAggregation.Aggregate(new[]
        {
            (Guid.NewGuid(), (Guid?)null, (double?)30.0, (double?)null, (string?)null, (DateTime?)null),
            (Guid.NewGuid(), (Guid?)null, (double?)null, (double?)-97.0, (string?)null, (DateTime?)null),
        });
        Assert.Empty(pins);
    }

    [Fact]
    public void Aggregate_preserves_order_and_thumbnails()
    {
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        var pins = TwinPhotoPinAggregation.Aggregate(new[]
        {
            (a, (Guid?)null, (double?)1.0, (double?)2.0, (string?)"first.jpg", (DateTime?)null),
            (b, (Guid?)Guid.NewGuid(), (double?)null, (double?)null, (string?)"second.jpg", (DateTime?)null),
        });
        Assert.Equal(2, pins.Count);
        Assert.Equal(a, pins[0].PhotoId);
        Assert.Equal("first.jpg", pins[0].ThumbnailUrl);
        Assert.Equal(b, pins[1].PhotoId);
        Assert.Equal("second.jpg", pins[1].ThumbnailUrl);
    }

    [Fact]
    public void Empty_with_zone_id_still_zero_pins_and_not_all_clear()
    {
        var projectId = Guid.NewGuid();
        var zoneId = Guid.NewGuid();
        var empty = TwinPhotoPinAggregation.Empty(projectId, zoneId);
        Assert.Empty(empty.Pins);
        Assert.Equal(zoneId, empty.SpatialNodeId);
        Assert.DoesNotContain("all clear", empty.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("not all-clear", empty.Message, StringComparison.OrdinalIgnoreCase);
    }
}
