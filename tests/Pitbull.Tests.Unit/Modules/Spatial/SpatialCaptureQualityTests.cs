using Pitbull.ProjectManagement.Features;
using Xunit;

namespace Pitbull.Tests.Unit.Modules.Spatial;

/// <summary>2.18.7 — labeled quality metric, not vanity KPI.</summary>
public class SpatialCaptureQualityTests
{
    [Fact]
    public void CombinedPercent_null_when_no_rows()
    {
        Assert.Null(SpatialCaptureQualityCalculator.CombinedPercent(0, 0));
    }

    [Fact]
    public void CombinedPercent_rounds_one_decimal()
    {
        // 1/3 → 33.3
        Assert.Equal(33.3m, SpatialCaptureQualityCalculator.CombinedPercent(3, 1)!);
        Assert.Equal(100m, SpatialCaptureQualityCalculator.CombinedPercent(4, 4)!);
        Assert.Equal(0m, SpatialCaptureQualityCalculator.CombinedPercent(5, 0)!);
    }

    [Fact]
    public void HasSpatialRef_true_for_zone_or_plan()
    {
        var zone = Guid.NewGuid();
        Assert.True(SpatialCaptureQualityCalculator.HasSpatialRef(zone));
        Assert.True(SpatialCaptureQualityCalculator.HasSpatialRef(null, Guid.NewGuid()));
        Assert.False(SpatialCaptureQualityCalculator.HasSpatialRef(null, null));
    }
}
