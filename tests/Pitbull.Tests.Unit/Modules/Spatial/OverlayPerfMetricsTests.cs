using Pitbull.ProjectManagement.Features;

namespace Pitbull.Tests.Unit.Modules.Spatial;

/// <summary>2.17.5 — diagnostic overlay p95 helper (not a product KPI).</summary>
public class OverlayPerfMetricsTests
{
    [Fact]
    public void FormatFuelLog_is_diagnostic_not_kpi()
    {
        var line = OverlayPerfMetrics.FormatFuelLog(Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"), "rfi", 4, 12);
        Assert.Contains("twin_overlay_fuel", line, StringComparison.Ordinal);
        Assert.Contains("elapsed_ms=12", line, StringComparison.Ordinal);
        Assert.DoesNotContain("health_score", line, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ApproximateP95_from_sorted_sample()
    {
        var sample = Enumerable.Range(1, 100).Select(i => (long)i).ToList();
        Assert.Equal(95, OverlayPerfMetrics.ApproximateP95(sample));
        Assert.Equal(0, OverlayPerfMetrics.ApproximateP95(Array.Empty<long>()));
    }
}
