namespace Pitbull.TimeTracking.Services;

/// <summary>
/// Validates GPS coordinates against project geofence boundaries.
/// Uses the Haversine formula for accurate distance calculation on the Earth's surface.
/// </summary>
public interface IGeofenceService
{
    /// <summary>
    /// Validate whether a GPS position is within a project's geofence radius.
    /// </summary>
    /// <param name="lat">Device latitude</param>
    /// <param name="lng">Device longitude</param>
    /// <param name="projectLat">Project site latitude</param>
    /// <param name="projectLng">Project site longitude</param>
    /// <param name="radiusMeters">Geofence radius in meters</param>
    /// <returns>Geofence validation result with distance and warning if outside</returns>
    GeofenceResult ValidateLocation(decimal lat, decimal lng, decimal projectLat, decimal projectLng, decimal radiusMeters);
}

public class GeofenceService : IGeofenceService
{
    private const double EarthRadiusMeters = 6_371_000;

    public GeofenceResult ValidateLocation(
        decimal lat, decimal lng,
        decimal projectLat, decimal projectLng,
        decimal radiusMeters)
    {
        var distanceMeters = (decimal)HaversineDistance(
            (double)lat, (double)lng,
            (double)projectLat, (double)projectLng);

        var withinGeofence = distanceMeters <= radiusMeters;

        string? warning = withinGeofence
            ? null
            : $"Time entry location is {distanceMeters:F0}m from the project site (geofence radius: {radiusMeters:F0}m)";

        return new GeofenceResult(withinGeofence, distanceMeters, warning);
    }

    /// <summary>
    /// Haversine formula — great-circle distance between two points on a sphere.
    /// Returns distance in meters.
    /// </summary>
    private static double HaversineDistance(double lat1, double lon1, double lat2, double lon2)
    {
        var dLat = DegreesToRadians(lat2 - lat1);
        var dLon = DegreesToRadians(lon2 - lon1);

        var lat1Rad = DegreesToRadians(lat1);
        var lat2Rad = DegreesToRadians(lat2);

        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
              + Math.Cos(lat1Rad) * Math.Cos(lat2Rad)
              * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));

        return EarthRadiusMeters * c;
    }

    private static double DegreesToRadians(double degrees) => degrees * Math.PI / 180.0;
}

/// <summary>
/// Result of a geofence validation check.
/// </summary>
public record GeofenceResult(
    bool WithinGeofence,
    decimal DistanceMeters,
    string? Warning);
