using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features.RemoveEmployeeFromProject;

public sealed class RemoveEmployeeFromProjectHandler(PitbullDbContext db)
    : IRequestHandler<RemoveEmployeeFromProjectCommand, Result>
{
    public async Task<Result> Handle(
        RemoveEmployeeFromProjectCommand request, CancellationToken cancellationToken)
    {
        var assignment = await db.Set<ProjectAssignment>()
            .FirstOrDefaultAsync(pa => pa.Id == request.AssignmentId && pa.IsActive, cancellationToken);

        if (assignment == null)
            return Result.Failure("Assignment not found or already inactive", "ASSIGNMENT_NOT_FOUND");

        // Set end date and deactivate
        assignment.EndDate = request.EndDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        assignment.IsActive = false;

        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}

public sealed class RemoveEmployeeFromProjectByIdsHandler(PitbullDbContext db)
    : IRequestHandler<RemoveEmployeeFromProjectByIdsCommand, Result>
{
    public async Task<Result> Handle(
        RemoveEmployeeFromProjectByIdsCommand request, CancellationToken cancellationToken)
    {
        var assignment = await db.Set<ProjectAssignment>()
            .FirstOrDefaultAsync(pa => pa.EmployeeId == request.EmployeeId
                                    && pa.ProjectId == request.ProjectId
                                    && pa.IsActive,
                                 cancellationToken);

        if (assignment == null)
            return Result.Failure("No active assignment found for this employee and project", "ASSIGNMENT_NOT_FOUND");

        // Set end date and deactivate
        assignment.EndDate = request.EndDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        assignment.IsActive = false;

        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
