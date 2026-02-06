using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features.GetEmployeeProjects;

/// <summary>
/// Get all projects an employee is assigned to
/// </summary>
public record GetEmployeeProjectsQuery(
    Guid EmployeeId,
    bool ActiveOnly = true,
    DateOnly? AsOfDate = null) : IRequest<Result<IReadOnlyList<ProjectAssignmentDto>>>;

public sealed class GetEmployeeProjectsHandler(PitbullDbContext db)
    : IRequestHandler<GetEmployeeProjectsQuery, Result<IReadOnlyList<ProjectAssignmentDto>>>
{
    public async Task<Result<IReadOnlyList<ProjectAssignmentDto>>> Handle(
        GetEmployeeProjectsQuery request, CancellationToken cancellationToken)
    {
        var query = db.Set<ProjectAssignment>()
            .Include(pa => pa.Employee)
            .Include(pa => pa.Project)
            .Where(pa => pa.EmployeeId == request.EmployeeId);

        if (request.ActiveOnly)
            query = query.Where(pa => pa.IsActive);

        // Filter by date if specified (check if assignment is valid for that date)
        if (request.AsOfDate.HasValue)
        {
            var asOf = request.AsOfDate.Value;
            query = query.Where(pa => pa.StartDate <= asOf 
                                   && (pa.EndDate == null || pa.EndDate >= asOf));
        }

        var assignments = await query
            .OrderBy(pa => pa.Project.Name)
            .Select(pa => ProjectAssignmentMapper.ToDto(pa))
            .ToListAsync(cancellationToken);

        return Result.Success<IReadOnlyList<ProjectAssignmentDto>>(assignments);
    }
}
