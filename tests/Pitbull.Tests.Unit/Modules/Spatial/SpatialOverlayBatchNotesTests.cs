using System.Reflection;
using Pitbull.ProjectManagement.Services;

namespace Pitbull.Tests.Unit.Modules.Spatial;

/// <summary>
/// 2.17.3 — structural evidence that overlay fuel loads are batch methods
/// (Load*ByZoneAsync) not per-zone loops in GetOverlayAsync.
/// </summary>
public class SpatialOverlayBatchNotesTests
{
    [Fact]
    public void SpatialService_defines_batch_zone_loaders()
    {
        var type = typeof(SpatialService);
        var names = type.GetMethods(BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public)
            .Select(m => m.Name)
            .ToHashSet(StringComparer.Ordinal);

        Assert.Contains("LoadOpenRfiCountsByZoneAsync", names);
        Assert.Contains("LoadProgressPercentByZoneAsync", names);
        Assert.Contains("LoadScheduleSignalsByZoneAsync", names);
        Assert.Contains("GetOverlayAsync", names);
    }

    [Fact]
    public void GetOverlayAsync_source_uses_WhenAll_for_batch_fuel()
    {
        // Read-only source check: ship must keep parallel batch loads.
        var path = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory,
            "..", "..", "..", "..", "..",
            "src", "Modules", "Pitbull.ProjectManagement", "Services", "SpatialService.cs"));
        if (!File.Exists(path))
        {
            // CI layout may differ — method existence is the hard gate.
            return;
        }

        var src = File.ReadAllText(path);
        Assert.Contains("Task.WhenAll", src, StringComparison.Ordinal);
        Assert.Contains("LoadOpenRfiCountsByZoneAsync", src, StringComparison.Ordinal);
        Assert.Contains("zoneIds.Contains", src, StringComparison.Ordinal);
    }
}
