using Pitbull.Core.CQRS;

namespace Pitbull.TimeTracking.Features.BatchCreateTimeEntries;

/// <summary>
/// Command to create multiple time entries in a single transaction.
/// Used by foremen to enter time for their entire crew at once.
/// </summary>
public record BatchCreateTimeEntriesCommand(
    List<BatchTimeEntryItem> Entries,
    bool AllowPartialSuccess = false,
    bool IsDraft = false,
    Guid? SubmittedById = null
) : ICommand<BatchCreateTimeEntriesResult>;

/// <summary>
/// Individual time entry in a batch submission.
/// CostCodeId is optional -- when Guid.Empty, the service auto-assigns the
/// tenant's default labor cost code (Code="LAB") for crew timecard entries.
/// </summary>
public record BatchTimeEntryItem(
    DateOnly Date,
    Guid EmployeeId,
    Guid ProjectId,
    Guid CostCodeId = default,
    decimal RegularHours = 0,
    decimal OvertimeHours = 0,
    decimal DoubletimeHours = 0,
    string? Description = null,
    Guid? PhaseId = null,
    Guid? EquipmentId = null,
    decimal EquipmentHours = 0,
    Guid? TimeEntryId = null
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
