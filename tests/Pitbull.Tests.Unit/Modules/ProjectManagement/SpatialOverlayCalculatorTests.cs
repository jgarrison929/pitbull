using FluentAssertions;
using Pitbull.ProjectManagement.Domain;

namespace Pitbull.Tests.Unit.Modules.ProjectManagement;

public sealed class SpatialOverlayCalculatorTests
{
    private static readonly Guid ZoneId = Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");

    [Fact]
    public void Rfi_null_count_is_insufficient_not_on_track()
    {
        var input = new SpatialOverlayCalculator.OverlayInput(
            ZoneId, "Zone", OpenRfiCount: null, ProgressPercent: null,
            IsScheduleCritical: null, DaysBehind: null);

        var result = SpatialOverlayCalculator.Compute(SpatialOverlayCalculator.ModeRfi, input);

        result.Band.Should().Be(SpatialOverlayCalculator.OverlayBand.InsufficientData);
        result.IsProxy.Should().BeTrue();
        result.InsufficientReason.Should().NotBeNullOrWhiteSpace();
        result.Label.Should().Contain("*");
    }

    [Fact]
    public void Rfi_zero_open_is_on_track()
    {
        var input = new SpatialOverlayCalculator.OverlayInput(
            ZoneId, "Zone", OpenRfiCount: 0, ProgressPercent: null,
            IsScheduleCritical: null, DaysBehind: null);

        var result = SpatialOverlayCalculator.Compute(SpatialOverlayCalculator.ModeRfi, input);

        result.Band.Should().Be(SpatialOverlayCalculator.OverlayBand.OnTrack);
        result.IsProxy.Should().BeFalse();
        result.Label.Should().Be("No open RFIs");
    }

    [Theory]
    [InlineData(1, SpatialOverlayCalculator.OverlayBand.Watch)]
    [InlineData(2, SpatialOverlayCalculator.OverlayBand.Watch)]
    [InlineData(3, SpatialOverlayCalculator.OverlayBand.Risk)]
    [InlineData(10, SpatialOverlayCalculator.OverlayBand.Risk)]
    public void Rfi_open_counts_band_correctly(int count, SpatialOverlayCalculator.OverlayBand expected)
    {
        var input = new SpatialOverlayCalculator.OverlayInput(
            ZoneId, "Zone", OpenRfiCount: count, ProgressPercent: null,
            IsScheduleCritical: null, DaysBehind: null);

        var result = SpatialOverlayCalculator.Compute(SpatialOverlayCalculator.ModeRfi, input);

        result.Band.Should().Be(expected);
        result.IsProxy.Should().BeTrue();
    }

    [Fact]
    public void Progress_missing_is_insufficient()
    {
        var input = new SpatialOverlayCalculator.OverlayInput(
            ZoneId, "Zone", OpenRfiCount: 0, ProgressPercent: null,
            IsScheduleCritical: null, DaysBehind: null);

        var result = SpatialOverlayCalculator.Compute(SpatialOverlayCalculator.ModeProgress, input);

        result.Band.Should().Be(SpatialOverlayCalculator.OverlayBand.InsufficientData);
        result.InsufficientReason.Should().Contain("progress");
    }

    [Theory]
    [InlineData(10, SpatialOverlayCalculator.OverlayBand.Risk)]
    [InlineData(50, SpatialOverlayCalculator.OverlayBand.Watch)]
    [InlineData(90, SpatialOverlayCalculator.OverlayBand.OnTrack)]
    public void Progress_percent_bands(decimal pct, SpatialOverlayCalculator.OverlayBand expected)
    {
        var input = new SpatialOverlayCalculator.OverlayInput(
            ZoneId, "Zone", OpenRfiCount: null, ProgressPercent: pct,
            IsScheduleCritical: null, DaysBehind: null);

        var result = SpatialOverlayCalculator.Compute(SpatialOverlayCalculator.ModeProgress, input);

        result.Band.Should().Be(expected);
        result.IsProxy.Should().BeTrue();
        result.Label.Should().Contain("%");
    }

    [Fact]
    public void Schedule_missing_links_is_insufficient()
    {
        var input = new SpatialOverlayCalculator.OverlayInput(
            ZoneId, "Zone", OpenRfiCount: null, ProgressPercent: null,
            IsScheduleCritical: null, DaysBehind: null);

        var result = SpatialOverlayCalculator.Compute(SpatialOverlayCalculator.ModeSchedule, input);

        result.Band.Should().Be(SpatialOverlayCalculator.OverlayBand.InsufficientData);
    }

    [Fact]
    public void Schedule_critical_with_delay_is_risk()
    {
        var input = new SpatialOverlayCalculator.OverlayInput(
            ZoneId, "Zone", OpenRfiCount: null, ProgressPercent: null,
            IsScheduleCritical: true, DaysBehind: 2);

        var result = SpatialOverlayCalculator.Compute(SpatialOverlayCalculator.ModeSchedule, input);

        result.Band.Should().Be(SpatialOverlayCalculator.OverlayBand.Risk);
        result.IsProxy.Should().BeTrue();
    }

    [Fact]
    public void Unknown_mode_is_insufficient()
    {
        var input = new SpatialOverlayCalculator.OverlayInput(
            ZoneId, "Zone", OpenRfiCount: 0, ProgressPercent: 100,
            IsScheduleCritical: false, DaysBehind: 0);

        var result = SpatialOverlayCalculator.Compute("heatmap-of-lies", input);

        result.Band.Should().Be(SpatialOverlayCalculator.OverlayBand.InsufficientData);
        result.InsufficientReason.Should().Contain("Unsupported");
    }

    [Fact]
    public void ComputeMany_preserves_order_and_ids()
    {
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        var inputs = new[]
        {
            new SpatialOverlayCalculator.OverlayInput(a, "Zone", 0, null, null, null),
            new SpatialOverlayCalculator.OverlayInput(b, "Zone", 5, null, null, null),
        };

        var results = SpatialOverlayCalculator.ComputeMany(SpatialOverlayCalculator.ModeRfi, inputs);

        results.Should().HaveCount(2);
        results[0].SpatialNodeId.Should().Be(a);
        results[0].Band.Should().Be(SpatialOverlayCalculator.OverlayBand.OnTrack);
        results[1].SpatialNodeId.Should().Be(b);
        results[1].Band.Should().Be(SpatialOverlayCalculator.OverlayBand.Risk);
    }
}
