using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.TimeTracking.Features.GetYesterdayCrewEntries;

/// <summary>
/// Get yesterday's time entries for the foreman's crew.
/// Used for the "Copy Yesterday" feature in crew batch entry.
/// </summary>
public record GetYesterdayCrewEntriesQuery(
    Guid ForemanId,
    DateOnly? TargetDate = null // If null, uses yesterday. This is the date to get entries FOR
) : IRequest<Result<YesterdayCrewEntriesResult>>;

/// <summary>
/// Result containing yesterday's crew time entries
/// </summary>
public record YesterdayCrewEntriesResult(
    DateOnly EntriesDate,
    int EmployeeCount,
    int EntryCount,
    decimal TotalHours,
    List<YesterdayCrewEmployeeEntries> EmployeeEntries
);

/// <summary>
/// Time entries for a single employee from yesterday
/// </summary>
public record YesterdayCrewEmployeeEntries(
    Guid EmployeeId,
    string EmployeeName,
    string EmployeeNumber,
    List<YesterdayTimeEntryDto> Entries
);

/// <summary>
/// Simplified time entry DTO for copy yesterday feature
/// </summary>
public record YesterdayTimeEntryDto(
    Guid ProjectId,
    string ProjectName,
    string ProjectNumber,
    Guid CostCodeId,
    string CostCodeCode,
    string CostCodeDescription,
    decimal RegularHours,
    decimal OvertimeHours,
    decimal DoubletimeHours,
    decimal TotalHours,
    string? Description
);
