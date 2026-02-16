namespace Pitbull.TimeTracking.Features.BulkSubmitTimeEntries;

public record BulkSubmitTimeEntriesCommand(
    List<Guid> TimeEntryIds,
    Guid SubmittedById
);

public record BulkSubmitTimeEntriesResult(
    int TotalRequested,
    int SuccessCount,
    int FailureCount,
    List<BulkSubmitEntryResult> Results
);

public record BulkSubmitEntryResult(
    Guid TimeEntryId,
    bool Success,
    string? Error,
    string? ErrorCode
);
