using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features.GetProjectAssignments;

/// <summary>
/// Get all employees assigned to a specific project
/// </summary>
public record GetProjectAssignmentsQuery(
    Guid ProjectId,
    bool ActiveOnly = true) : IRequest<Result<IReadOnlyList<ProjectAssignmentDto>>>;

public sealed class GetProjectAssignmentsHandler(PitbullDbContext db)
    : IRequestHandler<GetProjectAssignmentsQuery, Result<IReadOnlyList<ProjectAssignmentDto>>>
{
    public async Task<Result<IReadOnlyList<ProjectAssignmentDto>>> Handle(
        GetProjectAssignmentsQuery request, CancellationToken cancellationToken)
    {
        var query = db.Set<ProjectAssignment>()
            .Include(pa => pa.Employee)
            .Include(pa => pa.Project)
            .Where(pa => pa.ProjectId == request.ProjectId);

        if (request.ActiveOnly)
            query = query.Where(pa => pa.IsActive);

        var assignments = await query
            .OrderBy(pa => pa.Role)
            .ThenBy(pa => pa.Employee.LastName)
            .ThenBy(pa => pa.Employee.FirstName)
            .Select(pa => ProjectAssignmentMapper.ToDto(pa))
            .ToListAsync(cancellationToken);

        return Result.Success<IReadOnlyList<ProjectAssignmentDto>>(assignments);
    }
}
