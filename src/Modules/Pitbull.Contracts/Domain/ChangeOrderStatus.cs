namespace Pitbull.Contracts.Domain;

/// <summary>
/// Approval status of a change order.
/// </summary>
public enum ChangeOrderStatus
{
    Pending = 0,         // Submitted, awaiting review
    UnderReview = 1,     // Being evaluated
    Approved = 2,        // Approved - impacts contract value
    Rejected = 3,        // Denied
    Withdrawn = 4,       // Pulled back by submitter
    Void = 5             // Cancelled after approval
}

/// <summary>
/// Defines valid change order status transitions.
/// </summary>
public static class ChangeOrderStatusTransitions
{
    private static readonly Dictionary<ChangeOrderStatus, HashSet<ChangeOrderStatus>> Allowed = new()
    {
        [ChangeOrderStatus.Pending] = [ChangeOrderStatus.UnderReview, ChangeOrderStatus.Rejected, ChangeOrderStatus.Withdrawn],
        [ChangeOrderStatus.UnderReview] = [ChangeOrderStatus.Approved, ChangeOrderStatus.Rejected, ChangeOrderStatus.Withdrawn],
        [ChangeOrderStatus.Approved] = [ChangeOrderStatus.Void],
        [ChangeOrderStatus.Rejected] = [],
        [ChangeOrderStatus.Withdrawn] = [],
        [ChangeOrderStatus.Void] = [],
    };

    public static bool IsValid(ChangeOrderStatus from, ChangeOrderStatus to) =>
        from == to || (Allowed.TryGetValue(from, out var targets) && targets.Contains(to));

    public static IReadOnlySet<ChangeOrderStatus> GetAllowed(ChangeOrderStatus from) =>
        Allowed.TryGetValue(from, out var targets) ? targets : new HashSet<ChangeOrderStatus>();
}
