using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;
using Pitbull.Core.Logging;

namespace Pitbull.TimeTracking.Services;

/// <summary>
/// Service for managing project assignment operations, replacing MediatR-based handlers.
/// Consolidates all project assignment business logic into a single service.
/// </summary>
public class ProjectAssignmentService : IProjectAssignmentService
{
    private readonly PitbullDbContext _db;
    private readonly ILogger<ProjectAssignmentService> _logger;

    public ProjectAssignmentService(
        PitbullDbContext db,
        ILogger<ProjectAssignmentService> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<Result<ProjectAssignmentDto>> AssignEmployeeToProjectAsync(
        Guid employeeId,
        Guid projectId,
        AssignmentRole role = AssignmentRole.Worker,
        DateOnly? startDate = null,
        DateOnly? endDate = null,
        string? notes = null,
        CancellationToken cancellationToken = default)
    {
        // Validate that employee exists and is active
        var employee = await _db.Set<Employee>()
            .FirstOrDefaultAsync(e => e.Id == employeeId && e.IsActive, cancellationToken);

        if (employee == null)
            return Result.Failure<ProjectAssignmentDto>("Employee not found or inactive", "EMPLOYEE_NOT_FOUND");

        // Prefer change-tracker (create flow may stage project before SaveChanges).
        Project? project = _db.ChangeTracker.Entries<Project>()
            .Select(e => e.Entity)
            .FirstOrDefault(p => p.Id == projectId && !p.IsDeleted);

        project ??= await _db.Set<Project>()
            .FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted, cancellationToken);

        if (project is null)
            return Result.Failure<ProjectAssignmentDto>("Project not found", "PROJECT_NOT_FOUND");

        // Default start date to today if not specified
        var effectiveStartDate = startDate ?? DateOnly.FromDateTime(DateTime.UtcNow);

        // Check for existing active assignment to the same project
        var existingAssignment = await _db.Set<ProjectAssignment>()
            .AnyAsync(pa => pa.EmployeeId == employeeId
                        && pa.ProjectId == projectId
                        && pa.IsActive
                        && (pa.EndDate == null || pa.EndDate >= effectiveStartDate),
                      cancellationToken);

        if (existingAssignment)
            return Result.Failure<ProjectAssignmentDto>(
                "Employee is already assigned to this project",
                "ALREADY_ASSIGNED");

        // Validate end date is after start date
        if (endDate.HasValue && endDate.Value < effectiveStartDate)
            return Result.Failure<ProjectAssignmentDto>(
                "End date must be after start date",
                "INVALID_DATE_RANGE");

        var assignment = new ProjectAssignment
        {
            CompanyId = project.CompanyId,
            EmployeeId = employeeId,
            ProjectId = projectId,
            Role = role,
            StartDate = effectiveStartDate,
            EndDate = endDate,
            IsActive = true,
            Notes = notes
        };

        _db.Set<ProjectAssignment>().Add(assignment);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);

            // Load navigation properties for DTO
            await _db.Entry(assignment).Reference(a => a.Employee).LoadAsync(cancellationToken);
            await _db.Entry(assignment).Reference(a => a.Project).LoadAsync(cancellationToken);

            _logger.LogInformation("Assigned employee {EmployeeId} to project {ProjectId} with role {Role}",
                employeeId, projectId, role);

            return Result.Success(ProjectAssignmentMapper.ToDto(assignment));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to assign employee {EmployeeId} to project {ProjectId}",
                employeeId, projectId);
            return Result.Failure<ProjectAssignmentDto>("Failed to create assignment", "DATABASE_ERROR");
        }
    }

    /// <inheritdoc />
    public async Task<Result<IReadOnlyList<ProjectAssignmentDto>>> GetProjectAssignmentsAsync(
        Guid projectId,
        bool activeOnly = true,
        CancellationToken cancellationToken = default)
    {
        var query = _db.Set<ProjectAssignment>()
            .Include(pa => pa.Employee)
            .Include(pa => pa.Project)
            .Where(pa => pa.ProjectId == projectId);

        if (activeOnly)
            query = query.Where(pa => pa.IsActive);

        var assignments = await query
            .OrderBy(pa => pa.Role)
            .ThenBy(pa => pa.Employee.LastName)
            .ThenBy(pa => pa.Employee.FirstName)
            .Select(pa => ProjectAssignmentMapper.ToDto(pa))
            .ToListAsync(cancellationToken);

        return Result.Success<IReadOnlyList<ProjectAssignmentDto>>(assignments);
    }

    /// <inheritdoc />
    public async Task<Result<IReadOnlyList<ProjectAssignmentDto>>> GetEmployeeProjectsAsync(
        Guid employeeId,
        bool activeOnly = true,
        DateOnly? asOfDate = null,
        CancellationToken cancellationToken = default)
    {
        var query = _db.Set<ProjectAssignment>()
            .Include(pa => pa.Employee)
            .Include(pa => pa.Project)
            .Where(pa => pa.EmployeeId == employeeId);

        if (activeOnly)
            query = query.Where(pa => pa.IsActive);

        // Filter by date if specified (check if assignment is valid for that date)
        if (asOfDate.HasValue)
        {
            var asOf = asOfDate.Value;
            query = query.Where(pa => pa.StartDate <= asOf
                                   && (pa.EndDate == null || pa.EndDate >= asOf));
        }

        var assignments = await query
            .OrderBy(pa => pa.Project.Name)
            .Select(pa => ProjectAssignmentMapper.ToDto(pa))
            .ToListAsync(cancellationToken);

        return Result.Success<IReadOnlyList<ProjectAssignmentDto>>(assignments);
    }

    /// <inheritdoc />
    public async Task<Result> RemoveAssignmentAsync(
        Guid assignmentId,
        DateOnly? endDate = null,
        CancellationToken cancellationToken = default)
    {
        var assignment = await _db.Set<ProjectAssignment>()
            .FirstOrDefaultAsync(pa => pa.Id == assignmentId && pa.IsActive, cancellationToken);

        if (assignment == null)
            return Result.Failure("Assignment not found or already inactive", "ASSIGNMENT_NOT_FOUND");

        // Set end date and deactivate
        assignment.EndDate = endDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        assignment.IsActive = false;

        try
        {
            await _db.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Removed assignment {AssignmentId} with end date {EndDate}",
                assignmentId, LogSafe.Text(assignment.EndDate));

            return Result.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to remove assignment {AssignmentId}", assignmentId);
            return Result.Failure("Failed to remove assignment", "DATABASE_ERROR");
        }
    }

    /// <inheritdoc />
    public async Task<Result> RemoveAssignmentByIdsAsync(
        Guid employeeId,
        Guid projectId,
        DateOnly? endDate = null,
        CancellationToken cancellationToken = default)
    {
        var assignment = await _db.Set<ProjectAssignment>()
            .FirstOrDefaultAsync(pa => pa.EmployeeId == employeeId
                                    && pa.ProjectId == projectId
                                    && pa.IsActive,
                                 cancellationToken);

        if (assignment == null)
            return Result.Failure("No active assignment found for this employee and project", "ASSIGNMENT_NOT_FOUND");

        // Set end date and deactivate
        assignment.EndDate = endDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        assignment.IsActive = false;

        try
        {
            await _db.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Removed assignment for employee {EmployeeId} from project {ProjectId}",
                employeeId, projectId);

            return Result.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to remove assignment for employee {EmployeeId} from project {ProjectId}",
                employeeId, projectId);
            return Result.Failure("Failed to remove assignment", "DATABASE_ERROR");
        }
    }
}
