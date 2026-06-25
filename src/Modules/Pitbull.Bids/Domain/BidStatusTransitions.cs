namespace Pitbull.Bids.Domain;

/// <summary>
/// Defines valid bid lifecycle transitions (estimate → award → project conversion).
/// </summary>
public static class BidStatusTransitions
{
    private static readonly Dictionary<BidStatus, HashSet<BidStatus>> Allowed = new()
    {
        [BidStatus.Draft] = [BidStatus.Submitted, BidStatus.Cancelled],
        [BidStatus.Submitted] = [BidStatus.Won, BidStatus.Lost, BidStatus.NoResponse, BidStatus.Cancelled],
        [BidStatus.Won] = [],
        [BidStatus.Lost] = [],
        [BidStatus.NoResponse] = [],
        [BidStatus.Cancelled] = [],
        [BidStatus.Converted] = [],
    };

    public static bool IsValid(BidStatus from, BidStatus to) =>
        from == to || (Allowed.TryGetValue(from, out var targets) && targets.Contains(to));

    public static IReadOnlySet<BidStatus> GetAllowed(BidStatus from) =>
        Allowed.TryGetValue(from, out var targets) ? targets : new HashSet<BidStatus>();
}