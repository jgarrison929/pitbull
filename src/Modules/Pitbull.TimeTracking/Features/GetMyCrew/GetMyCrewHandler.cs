using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features.GetMyCrew;

public sealed class GetMyCrewHandler(PitbullDbContext db)
    : IRequestHandler<GetMyCrewQuery, Result<MyCrewResult>>
{
    public async Task<Result<MyCrewResult>> Handle(
        GetMyCrewQuery request, CancellationToken cancellationToken)
    {
        // Validate supervisor exists
        var supervisor = await db.Set<Employee>()
            .FirstOrDefaultAsync(e => e.Id == request.SupervisorId, cancellationToken);

        if (supervisor == null)
            return Result.Failure<MyCrewResult>(
                "Supervisor not found", "SUPERVISOR_NOT_FOUND");

        // Get crew members - employees who have this user as their supervisor
        var crewQuery = db.Set<Employee>()
            .Where(e => e.SupervisorId == request.SupervisorId);

        if (request.ActiveOnly)
            crewQuery = crewQuery.Where(e => e.IsActive);

        var crewMembers = await crewQuery
            .OrderBy(e => e.LastName)
            .ThenBy(e => e.FirstName)
            .ToListAsync(cancellationToken);

        if (crewMembers.Count == 0)
        {
            return Result.Success(new MyCrewResult(
                supervisor.Id,
                supervisor.FullName,
                0,
                []));
        }

        // Get active project assignments for all crew members
        var crewIds = crewMembers.Select(c => c.Id).ToList();
        var today = DateOnly.FromDateTime(DateTime.Today);

        var assignments = await db.Set<ProjectAssignment>()
            .Where(pa => crewIds.Contains(pa.EmployeeId)
                      && pa.IsActive
                      && pa.StartDate <= today
                      && (pa.EndDate == null || pa.EndDate >= today))
            .Include(pa => pa.Project)
            .ToListAsync(cancellationToken);

        // Build the result
        var crewMemberDtos = crewMembers.Select(cm =>
        {
            var memberAssignments = assignments
                .Where(a => a.EmployeeId == cm.Id)
                .Select(a => new CrewMemberProjectDto(
                    a.ProjectId,
                    a.Project.Number,
                    a.Project.Name,
                    a.Project.Status != ProjectStatus.Completed && 
                    a.Project.Status != ProjectStatus.Closed))
                .ToList();

            return new CrewMemberDto(
                cm.Id,
                cm.EmployeeNumber,
                cm.FirstName,
                cm.LastName,
                cm.FullName,
                cm.Title,
                cm.Classification,
                cm.BaseHourlyRate,
                cm.IsActive,
                memberAssignments);
        }).ToList();

        return Result.Success(new MyCrewResult(
            supervisor.Id,
            supervisor.FullName,
            crewMemberDtos.Count,
            crewMemberDtos));
    }
}
