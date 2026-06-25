namespace Pitbull.ProjectManagement.Domain;

/// <summary>
/// Daily report field workflow: Draft → Submitted → Approved → Locked.
/// </summary>
public static class DailyReportStatusTransitions
{
    private static readonly Dictionary<DailyReportStatus, HashSet<DailyReportStatus>> Allowed = new()
    {
        [DailyReportStatus.Draft] = [DailyReportStatus.Submitted],
        [DailyReportStatus.Submitted] = [DailyReportStatus.Approved],
        [DailyReportStatus.Approved] = [DailyReportStatus.Locked],
        [DailyReportStatus.Locked] = [],
    };

    public static bool IsValid(DailyReportStatus from, DailyReportStatus to) =>
        from == to || (Allowed.TryGetValue(from, out var targets) && targets.Contains(to));

    /// <summary>
    /// Action endpoints: rejects no-op and invalid jumps (unlike <see cref="IsValid"/> which allows from == to).
    /// </summary>
    public static bool CanTransition(DailyReportStatus from, DailyReportStatus to) =>
        from != to && Allowed.TryGetValue(from, out var targets) && targets.Contains(to);

    public static IReadOnlySet<DailyReportStatus> GetAllowed(DailyReportStatus from) =>
        Allowed.TryGetValue(from, out var targets) ? targets : new HashSet<DailyReportStatus>();
}