using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features;

/// <summary>
/// Mapper for converting TimeEntry entities to DTOs
/// </summary>
public static class TimeEntryMapper
{
    public static TimeEntryDto ToDto(TimeEntry timeEntry)
    {
        return new TimeEntryDto(
            Id: timeEntry.Id,
            Date: timeEntry.Date,
            EmployeeId: timeEntry.EmployeeId,
            EmployeeName: timeEntry.Employee?.FullName ?? "Unknown Employee",
            ProjectId: timeEntry.ProjectId,
            ProjectName: timeEntry.Project?.Name ?? "Unknown Project",
            ProjectNumber: timeEntry.Project?.Number ?? "N/A",
            CostCodeId: timeEntry.CostCodeId,
            CostCodeDescription: timeEntry.CostCode?.Description ?? "Unknown Cost Code",
            RegularHours: timeEntry.RegularHours,
            OvertimeHours: timeEntry.OvertimeHours,
            DoubletimeHours: timeEntry.DoubletimeHours,
            TotalHours: timeEntry.TotalHours,
            Description: timeEntry.Description,
            Status: timeEntry.Status,
            ApprovedById: timeEntry.ApprovedById,
            ApprovedByName: timeEntry.ApprovedBy?.FullName,
            ApprovedAt: timeEntry.ApprovedAt,
            ApprovalComments: timeEntry.ApprovalComments,
            RejectionReason: timeEntry.RejectionReason,
            CreatedAt: timeEntry.CreatedAt,
            UpdatedAt: timeEntry.UpdatedAt
        );
    }

    public static List<TimeEntryDto> ToDto(IEnumerable<TimeEntry> timeEntries) => [.. timeEntries.Select(ToDto)];
}
