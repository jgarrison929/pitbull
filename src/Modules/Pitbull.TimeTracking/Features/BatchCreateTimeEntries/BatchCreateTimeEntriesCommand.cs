using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.TimeTracking.Features.BatchCreateTimeEntries;

/// <summary>
/// Command to create multiple time entries in a single transaction.
/// Used by foremen to enter time for their entire crew at once.
/// </summary>
public record BatchCreateTimeEntriesCommand(
    List<BatchTimeEntryItem> Entries,
    bool AllowPartialSuccess = false
) : IRequest<Result<BatchCreateTimeEntriesResult>>;

/// <summary>
/// Individual time entry in a batch submission
/// </summary>
public record BatchTimeEntryItem(
    DateOnly Date,
    Guid EmployeeId,
    Guid ProjectId,
    Guid CostCodeId,
    decimal RegularHours,
    decimal OvertimeHours = 0,
    decimal DoubletimeHours = 0,
    string? Description = null
);

/// <summary>
/// Result of batch time entry creation
/// </summary>
public record BatchCreateTimeEntriesResult(
    int TotalSubmitted,
    int SuccessCount,
    int FailureCount,
    List<BatchEntryResult> Results
);

/// <summary>
/// Result for an individual entry in the batch
/// </summary>
public record BatchEntryResult(
    int Index,
    Guid? TimeEntryId,
    Guid EmployeeId,
    string EmployeeName,
    bool Success,
    string? Error,
    string? ErrorCode
);
