namespace Pitbull.TimeTracking.Features.GetReviewQueue;

public record ReviewQueueResult(
    DateOnly StartDate,
    DateOnly EndDate,
    int TotalEntries,
    int TotalProjects,
    decimal TotalRegularHours,
    decimal TotalOvertimeHours,
    decimal TotalDoubletimeHours,
    decimal TotalHours,
    List<ReviewQueueProjectGroup> Groups
);

public record ReviewQueueProjectGroup(
    Guid ProjectId,
    string ProjectNumber,
    string ProjectName,
    int EntryCount,
    int EmployeeCount,
    decimal TotalRegularHours,
    decimal TotalOvertimeHours,
    decimal TotalDoubletimeHours,
    decimal TotalHours,
    List<TimeEntryDto> Entries
);
