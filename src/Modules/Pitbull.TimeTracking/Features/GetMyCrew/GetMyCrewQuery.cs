using Pitbull.Core.CQRS;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features.GetMyCrew;

/// <summary>
/// Get employees assigned to the current user (foreman/supervisor).
/// Based on the SupervisorId relationship on Employee.
/// </summary>
public record GetMyCrewQuery(
    Guid SupervisorId,
    bool ActiveOnly = true
) : IQuery<MyCrewResult>;

/// <summary>
/// Result containing the crew members
/// </summary>
public record MyCrewResult(
    Guid SupervisorId,
    string SupervisorName,
    int CrewCount,
    List<CrewMemberDto> CrewMembers
);

/// <summary>
/// Crew member information for batch entry
/// </summary>
public record CrewMemberDto(
    Guid Id,
    string EmployeeNumber,
    string FirstName,
    string LastName,
    string FullName,
    string? Title,
    EmployeeClassification Classification,
    decimal BaseHourlyRate,
    bool IsActive,
    List<CrewMemberProjectDto> AssignedProjects
);

/// <summary>
/// Project assignment info for a crew member
/// </summary>
public record CrewMemberProjectDto(
    Guid ProjectId,
    string ProjectNumber,
    string ProjectName,
    bool IsActive
);
