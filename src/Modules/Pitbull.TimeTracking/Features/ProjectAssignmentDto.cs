using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features;

/// <summary>
/// Project assignment data transfer object for API responses
/// </summary>
public record ProjectAssignmentDto(
    Guid Id,
    Guid EmployeeId,
    string EmployeeName,
    string EmployeeNumber,
    Guid ProjectId,
    string ProjectName,
    string ProjectNumber,
    AssignmentRole Role,
    string RoleDescription,
    DateOnly StartDate,
    DateOnly? EndDate,
    bool IsActive,
    string? Notes,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

/// <summary>
/// Mapper for ProjectAssignment -> DTO
/// </summary>
public static class ProjectAssignmentMapper
{
    public static ProjectAssignmentDto ToDto(ProjectAssignment assignment)
    {
        return new ProjectAssignmentDto(
            Id: assignment.Id,
            EmployeeId: assignment.EmployeeId,
            EmployeeName: assignment.Employee?.FullName ?? string.Empty,
            EmployeeNumber: assignment.Employee?.EmployeeNumber ?? string.Empty,
            ProjectId: assignment.ProjectId,
            ProjectName: assignment.Project?.Name ?? string.Empty,
            ProjectNumber: assignment.Project?.Number ?? string.Empty,
            Role: assignment.Role,
            RoleDescription: assignment.Role.ToString(),
            StartDate: assignment.StartDate,
            EndDate: assignment.EndDate,
            IsActive: assignment.IsActive,
            Notes: assignment.Notes,
            CreatedAt: assignment.CreatedAt,
            UpdatedAt: assignment.UpdatedAt
        );
    }
}
