namespace Pitbull.ProjectManagement.Domain;

/// <summary>
/// Submittal log workflow per construction document control standards.
/// </summary>
public static class SubmittalStatusTransitions
{
    private static readonly Dictionary<SubmittalStatus, HashSet<SubmittalStatus>> Allowed = new()
    {
        [SubmittalStatus.Draft] = [SubmittalStatus.Submitted],
        [SubmittalStatus.Submitted] = [SubmittalStatus.InReview],
        [SubmittalStatus.InReview] = [
            SubmittalStatus.Approved,
            SubmittalStatus.ApprovedAsNoted,
            SubmittalStatus.ReviseAndResubmit,
            SubmittalStatus.Rejected
        ],
        [SubmittalStatus.ReviseAndResubmit] = [SubmittalStatus.Draft],
        [SubmittalStatus.Rejected] = [SubmittalStatus.Draft],
        [SubmittalStatus.Approved] = [SubmittalStatus.Closed],
        [SubmittalStatus.ApprovedAsNoted] = [SubmittalStatus.Closed],
        [SubmittalStatus.Closed] = [],
    };

    public static bool IsValid(SubmittalStatus from, SubmittalStatus to) =>
        from == to || (Allowed.TryGetValue(from, out var targets) && targets.Contains(to));

    public static IReadOnlySet<SubmittalStatus> GetAllowed(SubmittalStatus from) =>
        Allowed.TryGetValue(from, out var targets) ? targets : new HashSet<SubmittalStatus>();
}