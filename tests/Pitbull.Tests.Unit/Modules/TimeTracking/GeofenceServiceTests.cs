using FluentAssertions;
using Pitbull.TimeTracking.Services;

namespace Pitbull.Tests.Unit.Modules.TimeTracking;

public class GeofenceServiceTests
{
    private readonly GeofenceService _service = new();

    // Known reference: NYC Times Square ~40.7580, -73.9855
    // Known reference: NYC Empire State ~40.7484, -73.9857
    // Distance between them: ~107 meters

    [Fact]
    public void ValidateLocation_SamePoint_ReturnsWithinGeofence()
    {
        var result = _service.ValidateLocation(
            40.7580m, -73.9855m,
            40.7580m, -73.9855m,
            100m);

        result.WithinGeofence.Should().BeTrue();
        result.DistanceMeters.Should().Be(0m);
        result.Warning.Should().BeNull();
    }

    [Fact]
    public void ValidateLocation_WithinRadius_ReturnsWithinGeofence()
    {
        // ~1068m apart, 1200m radius
        var result = _service.ValidateLocation(
            40.7580m, -73.9855m,
            40.7484m, -73.9857m,
            1200m);

        result.WithinGeofence.Should().BeTrue();
        result.DistanceMeters.Should().BeLessThan(1200m);
        result.Warning.Should().BeNull();
    }

    [Fact]
    public void ValidateLocation_OutsideRadius_ReturnsOutsideWithWarning()
    {
        // ~1068m apart, 500m radius
        var result = _service.ValidateLocation(
            40.7580m, -73.9855m,
            40.7484m, -73.9857m,
            500m);

        result.WithinGeofence.Should().BeFalse();
        result.DistanceMeters.Should().BeGreaterThan(500m);
        result.Warning.Should().NotBeNull();
        result.Warning.Should().Contain("geofence radius");
    }

    [Fact]
    public void ValidateLocation_ExactlyOnBoundary_ReturnsWithinGeofence()
    {
        // Calculate distance first, then use it as radius
        var distanceCheck = _service.ValidateLocation(
            40.7580m, -73.9855m,
            40.7484m, -73.9857m,
            999999m);

        // Use the exact distance as the radius — should be "within"
        var result = _service.ValidateLocation(
            40.7580m, -73.9855m,
            40.7484m, -73.9857m,
            distanceCheck.DistanceMeters);

        result.WithinGeofence.Should().BeTrue();
    }

    [Fact]
    public void ValidateLocation_LargeDistance_CalculatesCorrectly()
    {
        // NYC to London: ~5,570 km
        // NYC: 40.7128, -74.0060
        // London: 51.5074, -0.1278
        var result = _service.ValidateLocation(
            40.7128m, -74.0060m,
            51.5074m, -0.1278m,
            10_000_000m); // 10,000 km radius

        result.WithinGeofence.Should().BeTrue();
        // Should be approximately 5,570 km (5,570,000 meters)
        result.DistanceMeters.Should().BeInRange(5_500_000m, 5_650_000m);
    }

    [Fact]
    public void ValidateLocation_SmallRadiusNearbyPoints_WorksCorrectly()
    {
        // Points ~11m apart (0.0001 degrees latitude at equator)
        var result = _service.ValidateLocation(
            0.0000m, 0.0000m,
            0.0001m, 0.0000m,
            15m);

        result.WithinGeofence.Should().BeTrue();
        result.DistanceMeters.Should().BeInRange(10m, 12m);
    }

    [Fact]
    public void ValidateLocation_NegativeCoordinates_WorksCorrectly()
    {
        // Sydney: -33.8688, 151.2093
        // Melbourne: -37.8136, 144.9631
        var result = _service.ValidateLocation(
            -33.8688m, 151.2093m,
            -37.8136m, 144.9631m,
            1_000_000m);

        result.WithinGeofence.Should().BeTrue();
        // Distance should be approximately 713 km
        result.DistanceMeters.Should().BeInRange(700_000m, 730_000m);
    }

    [Fact]
    public void ValidateLocation_ZeroRadius_OnlyExactMatchIsWithin()
    {
        var result = _service.ValidateLocation(
            40.7580m, -73.9855m,
            40.7580m, -73.9855m,
            0m);

        result.WithinGeofence.Should().BeTrue();
        result.DistanceMeters.Should().Be(0m);

        var result2 = _service.ValidateLocation(
            40.7580m, -73.9855m,
            40.7581m, -73.9855m,
            0m);

        result2.WithinGeofence.Should().BeFalse();
    }

    [Fact]
    public void ValidateLocation_TypicalJobSite_500mRadius()
    {
        // Typical construction site radius: 500m
        // Worker at project site entrance vs project center
        // ~100m away
        var result = _service.ValidateLocation(
            33.7490m, -84.3880m,   // Worker position
            33.7500m, -84.3880m,   // Project center
            500m);

        result.WithinGeofence.Should().BeTrue();
        result.Warning.Should().BeNull();
    }

    [Fact]
    public void ValidateLocation_WarningMessage_ContainsDistanceAndRadius()
    {
        var result = _service.ValidateLocation(
            40.7580m, -73.9855m,
            40.7484m, -73.9857m,
            10m); // Very small radius

        result.WithinGeofence.Should().BeFalse();
        result.Warning.Should().Contain("10m");
        result.Warning.Should().Contain("from the project site");
    }

    [Fact]
    public void ValidateLocation_HaversineAccuracy_KnownDistance()
    {
        // LAX to JFK: known distance ~3,983 km
        // LAX: 33.9425, -118.4081
        // JFK: 40.6413, -73.7781
        var result = _service.ValidateLocation(
            33.9425m, -118.4081m,
            40.6413m, -73.7781m,
            10_000_000m);

        // Should be approximately 3,983 km (within 1% accuracy)
        result.DistanceMeters.Should().BeInRange(3_940_000m, 4_030_000m);
    }
}
