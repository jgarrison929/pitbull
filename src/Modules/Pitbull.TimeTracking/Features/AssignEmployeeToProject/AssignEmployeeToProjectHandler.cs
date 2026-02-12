using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features.AssignEmployeeToProject;

public sealed class AssignEmployeeToProjectHandler(PitbullDbContext db)
    : IRequestHandler<AssignEmployeeToProjectCommand, Result<ProjectAssignmentDto>>
{
    public async Task<Result<ProjectAssignmentDto>> Handle(
        AssignEmployeeToProjectCommand request, CancellationToken cancellationToken)
    {
        // Validate that employee exists and is active
        var employee = await db.Set<Employee>()
            .FirstOrDefaultAsync(e => e.Id == request.EmployeeId && e.IsActive, cancellationToken);

        if (employee == null)
            return Result.Failure<ProjectAssignmentDto>("Employee not found or inactive", "EMPLOYEE_NOT_FOUND");

        // Validate that project exists
        var project = await db.Set<Project>()
            .FirstOrDefaultAsync(p => p.Id == request.ProjectId, cancellationToken);

        if (project == null)
            return Result.Failure<ProjectAssignmentDto>("Project not found", "PROJECT_NOT_FOUND");

        // Default start date to today if not specified
        var startDate = request.StartDate ?? DateOnly.FromDateTime(DateTime.UtcNow);

        // Check for existing active assignment to the same project
        var existingAssignment = await db.Set<ProjectAssignment>()
            .AnyAsync(pa => pa.EmployeeId == request.EmployeeId
                        && pa.ProjectId == request.ProjectId
                        && pa.IsActive
                        && (pa.EndDate == null || pa.EndDate >= startDate),
                      cancellationToken);

        if (existingAssignment)
            return Result.Failure<ProjectAssignmentDto>(
                "Employee is already assigned to this project",
                "DUPLICATE_ASSIGNMENT");

        // Validate end date is after start date
        if (request.EndDate.HasValue && request.EndDate.Value < startDate)
            return Result.Failure<ProjectAssignmentDto>(
                "End date must be after start date",
                "INVALID_DATE_RANGE");

        var assignment = new ProjectAssignment
        {
            EmployeeId = request.EmployeeId,
            ProjectId = request.ProjectId,
            Role = request.Role,
            StartDate = startDate,
            EndDate = request.EndDate,
            IsActive = true,
            Notes = request.Notes
        };

        db.Set<ProjectAssignment>().Add(assignment);
        await db.SaveChangesAsync(cancellationToken);

        // Load navigation properties for DTO
        await db.Entry(assignment).Reference(a => a.Employee).LoadAsync(cancellationToken);
        await db.Entry(assignment).Reference(a => a.Project).LoadAsync(cancellationToken);

        return Result.Success(ProjectAssignmentMapper.ToDto(assignment));
    }
}
