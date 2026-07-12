namespace Pitbull.ProjectManagement.Features;

/// <summary>
/// Diagnostic overlay timing helpers (2.17.5). Not product health KPIs.
/// </summary>
public static class OverlayPerfMetrics
{
    /// <summary>Format a structured log line for overlay fuel load duration.</summary>
    public static string FormatFuelLog(Guid projectId, string mode, int zoneCount, long elapsedMs) =>
        $"twin_overlay_fuel project_id={projectId:N} mode={mode} zone_count={zoneCount} elapsed_ms={elapsedMs}";

    /// <summary>
    /// Approximate p95 from a sorted sample of durations (diagnostic).
    /// Empty sample returns 0.
    /// </summary>
    public static long ApproximateP95(IReadOnlyList<long> sortedAscendingMs)
    {
        if (sortedAscendingMs.Count == 0) return 0;
        var idx = (int)Math.Ceiling(sortedAscendingMs.Count * 0.95) - 1;
        if (idx < 0) idx = 0;
        if (idx >= sortedAscendingMs.Count) idx = sortedAscendingMs.Count - 1;
        return sortedAscendingMs[idx];
    }
}
