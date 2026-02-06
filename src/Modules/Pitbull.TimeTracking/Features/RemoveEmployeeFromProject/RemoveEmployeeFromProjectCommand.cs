using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.TimeTracking.Features.RemoveEmployeeFromProject;

/// <summary>
/// Remove an employee's assignment from a project.
/// This deactivates the assignment rather than deleting it (preserving history).
/// </summary>
public record RemoveEmployeeFromProjectCommand(
    Guid AssignmentId,
    DateOnly? EndDate = null
) : IRequest<Result>;

/// <summary>
/// Alternative: remove by employee and project IDs
/// </summary>
public record RemoveEmployeeFromProjectByIdsCommand(
    Guid EmployeeId,
    Guid ProjectId,
    DateOnly? EndDate = null
) : IRequest<Result>;
