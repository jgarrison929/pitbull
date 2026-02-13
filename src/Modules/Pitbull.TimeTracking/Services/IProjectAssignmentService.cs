using Pitbull.Core.CQRS;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;

namespace Pitbull.TimeTracking.Services;

/// <summary>
/// Service for managing project assignment operations, replacing MediatR-based handlers.
/// Provides direct, testable methods for all project assignment-related business logic.
/// </summary>
public interface IProjectAssignmentService
{
    /// <summary>
    /// Assign an employee to a project with a specific role
    /// </summary>
    Task<Result<ProjectAssignmentDto>> AssignEmployeeToProjectAsync(
        Guid employeeId,
        Guid projectId,
        AssignmentRole role = AssignmentRole.Worker,
        DateOnly? startDate = null,
        DateOnly? endDate = null,
        string? notes = null,
        CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Get all employees assigned to a specific project
    /// </summary>
    Task<Result<IReadOnlyList<ProjectAssignmentDto>>> GetProjectAssignmentsAsync(
        Guid projectId,
        bool activeOnly = true,
        CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Get all projects an employee is assigned to
    /// </summary>
    Task<Result<IReadOnlyList<ProjectAssignmentDto>>> GetEmployeeProjectsAsync(
        Guid employeeId,
        bool activeOnly = true,
        DateOnly? asOfDate = null,
        CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Remove an employee's assignment from a project by assignment ID.
    /// This deactivates the assignment rather than deleting it (preserving history).
    /// </summary>
    Task<Result> RemoveAssignmentAsync(
        Guid assignmentId,
        DateOnly? endDate = null,
        CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Remove an employee's assignment from a project by employee and project IDs.
    /// This deactivates the assignment rather than deleting it (preserving history).
    /// </summary>
    Task<Result> RemoveAssignmentByIdsAsync(
        Guid employeeId,
        Guid projectId,
        DateOnly? endDate = null,
        CancellationToken cancellationToken = default);
}
