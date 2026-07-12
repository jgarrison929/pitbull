using Pitbull.ProjectManagement.Domain;

namespace Pitbull.Tests.Unit.Modules.Spatial;

/// <summary>2.17.7 — cost overlay never invents heat without allocation links.</summary>
public class SpatialCostOverlayTests
{
    [Fact]
    public void Cost_mode_without_allocation_is_insufficient_not_green()
    {
        var input = new SpatialOverlayCalculator.OverlayInput(
            Guid.NewGuid(),
            "Zone",
            OpenRfiCount: null,
            ProgressPercent: null,
            IsScheduleCritical: null,
            DaysBehind: null,
            HasCostAllocation: null);
        var r = SpatialOverlayCalculator.Compute(SpatialOverlayCalculator.ModeCost, input);
        Assert.Equal(SpatialOverlayCalculator.OverlayBand.InsufficientData, r.Band);
        Assert.Contains("not allocated", r.Label, StringComparison.OrdinalIgnoreCase);
        Assert.NotEqual(SpatialOverlayCalculator.OverlayBand.OnTrack, r.Band);
    }

    [Fact]
    public void Cost_mode_with_allocation_is_proxy_not_invented_on_track()
    {
        var input = new SpatialOverlayCalculator.OverlayInput(
            Guid.NewGuid(),
            "Zone",
            null,
            null,
            null,
            null,
            HasCostAllocation: true);
        var r = SpatialOverlayCalculator.Compute("cost", input);
        Assert.True(r.IsProxy);
        Assert.NotEqual(SpatialOverlayCalculator.OverlayBand.OnTrack, r.Band);
    }
}
