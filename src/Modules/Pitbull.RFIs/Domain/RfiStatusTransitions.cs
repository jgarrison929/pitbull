namespace Pitbull.RFIs.Domain;

/// <summary>
/// Defines valid RFI status transitions aligned with construction document control workflows.
/// </summary>
public static class RfiStatusTransitions
{
    private static readonly Dictionary<RfiStatus, HashSet<RfiStatus>> Allowed = new()
    {
        [RfiStatus.Open] = [RfiStatus.Answered],
        [RfiStatus.Answered] = [RfiStatus.Closed, RfiStatus.Open],
        [RfiStatus.Closed] = [],
    };

    public static bool IsValid(RfiStatus from, RfiStatus to) =>
        from == to || (Allowed.TryGetValue(from, out var targets) && targets.Contains(to));

    public static IReadOnlySet<RfiStatus> GetAllowed(RfiStatus from) =>
        Allowed.TryGetValue(from, out var targets) ? targets : new HashSet<RfiStatus>();
}