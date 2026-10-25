using Pitbull.Core.CQRS;

namespace Pitbull.TimeTracking.Features.ReviewTimeEntries;

public enum TimeEntryReviewDecisionType
{
    Approve = 0,
    Reject = 1
}

public record TimeEntryReviewDecision(
    Guid TimeEntryId,
    TimeEntryReviewDecisionType Decision,
    string? Comment = null
);

public record ReviewTimeEntriesCommand(
    List<TimeEntryReviewDecision> Decisions
) : ICommand<ReviewTimeEntriesResult>;

public record ReviewTimeEntriesResult(
    int Total,
    int Approved,
    int Rejected,
    int Failed,
    List<ReviewTimeEntryResult> Results
);

public record ReviewTimeEntryResult(
    Guid TimeEntryId,
    bool Success,
    string? Error = null,
    string? ErrorCode = null
);
