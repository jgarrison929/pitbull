namespace Pitbull.ProjectManagement.Domain;

/// <summary>
/// Pure overlay math for zones-first twin. No I/O — unit-testable without EF.
/// Truth rules: never invent green health; return InsufficientData when counts missing.
/// </summary>
public static class SpatialOverlayCalculator
{
    public const string ModeProgress = "progress";
    public const string ModeSchedule = "schedule";
    public const string ModeRfi = "rfi";
    /// <summary>Cost heat (2.17.7) — only when zone has allocation links; never fake cost colors.</summary>
    public const string ModeCost = "cost";

    public enum OverlayBand
    {
        InsufficientData = 0,
        OnTrack = 1,
        Watch = 2,
        Risk = 3
    }

    public sealed record OverlayInput(
        Guid SpatialNodeId,
        string NodeType,
        int? OpenRfiCount,
        decimal? ProgressPercent,
        bool? IsScheduleCritical,
        int? DaysBehind,
        /// <summary>True only when cost allocation exists for zone (no fake heat otherwise).</summary>
        bool? HasCostAllocation = null);

    public sealed record OverlayResult(
        Guid SpatialNodeId,
        string Mode,
        OverlayBand Band,
        string Label,
        string Source,
        bool IsProxy,
        string? Formula,
        string? InsufficientReason);

    public static OverlayResult Compute(string mode, OverlayInput input)
    {
        var m = (mode ?? "").Trim().ToLowerInvariant();
        return m switch
        {
            ModeRfi => ComputeRfi(input),
            ModeSchedule => ComputeSchedule(input),
            ModeProgress => ComputeProgress(input),
            ModeCost => ComputeCost(input),
            _ => new OverlayResult(
                input.SpatialNodeId,
                m,
                OverlayBand.InsufficientData,
                "Unknown mode",
                "none",
                IsProxy: false,
                Formula: null,
                InsufficientReason: $"Unsupported overlay mode '{mode}'")
        };
    }

    public static IReadOnlyList<OverlayResult> ComputeMany(
        string mode,
        IEnumerable<OverlayInput> inputs)
        => inputs.Select(i => Compute(mode, i)).ToList();

    /// <summary>
    /// Cost overlay (2.17.7): no allocation → InsufficientData (not green cost health).
    /// </summary>
    static OverlayResult ComputeCost(OverlayInput input)
    {
        const string source = "Spatial cost allocation by zone";
        if (input.HasCostAllocation != true)
        {
            return new OverlayResult(
                input.SpatialNodeId,
                ModeCost,
                OverlayBand.InsufficientData,
                "Cost by zone not allocated*",
                source,
                IsProxy: true,
                Formula: "HasCostAllocation != true → insufficient (no fake cost heat)",
                InsufficientReason: "No cost allocation links for this zone — cost overlay stays off");
        }

        // Allocation present but full cost engine deferred — proxy Watch, never invent OnTrack green.
        return Band(
            input,
            ModeCost,
            OverlayBand.Watch,
            "Cost allocated*",
            source,
            "allocation present; full cost heat deferred",
            proxy: true);
    }

    /// <summary>
    /// Zones only receive RFI coloring; non-zone nodes inherit InsufficientData
    /// unless they have explicit counts (rollup optional).
    /// </summary>
    static OverlayResult ComputeRfi(OverlayInput input)
    {
        const string source = "Rfi.OpenCount by SpatialNodeId (or unlinked → insufficient)";
        if (input.OpenRfiCount is null)
        {
            return new OverlayResult(
                input.SpatialNodeId,
                ModeRfi,
                OverlayBand.InsufficientData,
                "No RFI data*",
                source,
                IsProxy: true,
                Formula: "openRfiCount is null → insufficient",
                InsufficientReason: "No RFIs linked to this zone (not zero — unknown)");
        }

        var n = input.OpenRfiCount.Value;
        if (n <= 0)
            return Band(input, ModeRfi, OverlayBand.OnTrack, "No open RFIs", source, "openRfiCount == 0", proxy: false);
        if (n <= 2)
            return Band(input, ModeRfi, OverlayBand.Watch, $"{n} open RFIs*", source, "1–2 open RFIs", proxy: true);
        return Band(input, ModeRfi, OverlayBand.Risk, $"{n} open RFIs*", source, "≥3 open RFIs", proxy: true);
    }

    static OverlayResult ComputeSchedule(OverlayInput input)
    {
        const string source = "Schedule activities linked to zone (critical path / delay proxy)";
        if (input.IsScheduleCritical is null && input.DaysBehind is null)
        {
            return new OverlayResult(
                input.SpatialNodeId,
                ModeSchedule,
                OverlayBand.InsufficientData,
                "No schedule link*",
                source,
                IsProxy: true,
                Formula: null,
                InsufficientReason: "No schedule activities mapped to this zone");
        }

        var days = input.DaysBehind ?? 0;
        var critical = input.IsScheduleCritical == true;
        if (critical && days > 0)
            return Band(input, ModeSchedule, OverlayBand.Risk, $"Critical +{days}d*", source, "critical && daysBehind > 0", proxy: true);
        if (days >= 3)
            return Band(input, ModeSchedule, OverlayBand.Watch, $"{days}d behind*", source, "daysBehind >= 3", proxy: true);
        if (days > 0)
            return Band(input, ModeSchedule, OverlayBand.Watch, $"{days}d slip*", source, "daysBehind > 0", proxy: true);
        return Band(input, ModeSchedule, OverlayBand.OnTrack, "On schedule*", source, "no delay flags", proxy: true);
    }

    static OverlayResult ComputeProgress(OverlayInput input)
    {
        const string source = "Field progress % on zone (proxy until quantity-complete exists)";
        if (input.ProgressPercent is null)
        {
            return new OverlayResult(
                input.SpatialNodeId,
                ModeProgress,
                OverlayBand.InsufficientData,
                "No progress data*",
                source,
                IsProxy: true,
                Formula: null,
                InsufficientReason: "No progress entries for this zone");
        }

        var p = input.ProgressPercent.Value;
        if (p < 0) p = 0;
        if (p > 100) p = 100;
        if (p < 25)
            return Band(input, ModeProgress, OverlayBand.Risk, $"{p:0}% complete*", source, "progress < 25%", proxy: true);
        if (p < 75)
            return Band(input, ModeProgress, OverlayBand.Watch, $"{p:0}% complete*", source, "25% ≤ progress < 75%", proxy: true);
        return Band(input, ModeProgress, OverlayBand.OnTrack, $"{p:0}% complete*", source, "progress ≥ 75%", proxy: true);
    }

    static OverlayResult Band(
        OverlayInput input,
        string mode,
        OverlayBand band,
        string label,
        string source,
        string formula,
        bool proxy)
        => new(
            input.SpatialNodeId,
            mode,
            band,
            label,
            source,
            IsProxy: proxy,
            Formula: formula,
            InsufficientReason: null);
}
