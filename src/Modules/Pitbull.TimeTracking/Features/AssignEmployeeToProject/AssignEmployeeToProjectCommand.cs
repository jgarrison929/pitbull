using MediatR;
using Pitbull.Core.CQRS;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features.AssignEmployeeToProject;

/// <summary>
/// Assign an employee to a project with a specific role
/// </summary>
public record AssignEmployeeToProjectCommand(
    Guid EmployeeId,
    Guid ProjectId,
    AssignmentRole Role = AssignmentRole.Worker,
    DateOnly? StartDate = null,
    DateOnly? EndDate = null,
    string? Notes = null
) : IRequest<Result<ProjectAssignmentDto>>;
