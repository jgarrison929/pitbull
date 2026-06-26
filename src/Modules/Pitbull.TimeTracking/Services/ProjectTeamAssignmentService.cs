using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.Services;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Services;

public class ProjectTeamAssignmentService(PitbullDbContext db, ILogger<ProjectTeamAssignmentService> logger)
    : IProjectTeamAssignmentService
{
    public async Task<Result<(Guid? ProjectManagerId, Guid? SuperintendentId)>> AssignTeamMembersAsync(
        Guid projectId,
        IReadOnlyList<ProjectTeamMemberRequest> members,
        DateTime? projectStartDate,
        CancellationToken cancellationToken = default)
    {
        if (members.Count == 0)
            return Result.Success<(Guid? ProjectManagerId, Guid? SuperintendentId)>((null, null));

        var project = await db.Set<Project>()
            .FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted, cancellationToken);

        if (project is null)
            return Result.Failure<(Guid? ProjectManagerId, Guid? SuperintendentId)>("Project not found", "PROJECT_NOT_FOUND");

        DateOnly assignmentStartDate = projectStartDate.HasValue
            ? DateOnly.FromDateTime(projectStartDate.Value)
            : DateOnly.FromDateTime(DateTime.UtcNow);

        Guid? projectManagerId = null;
        Guid? superintendentId = null;

        foreach (ProjectTeamMemberRequest member in members)
        {
            var employee = await db.Set<Employee>()
                .FirstOrDefaultAsync(e => e.Id == member.EmployeeId && e.IsActive, cancellationToken);

            if (employee is null)
            {
                return Result.Failure<(Guid? ProjectManagerId, Guid? SuperintendentId)>(
                    "Employee not found or inactive",
                    "EMPLOYEE_NOT_FOUND");
            }

            AssignmentRole assignmentRole = MapTeamMemberRole(member.Role, out bool isProjectManager, out bool isSuperintendent);

            db.Set<ProjectAssignment>().Add(new ProjectAssignment
            {
                EmployeeId = member.EmployeeId,
                ProjectId = projectId,
                Role = assignmentRole,
                StartDate = assignmentStartDate,
                IsActive = true,
                Notes = member.Role
            });

            if (isProjectManager)
                projectManagerId = member.EmployeeId;
            if (isSuperintendent)
                superintendentId = member.EmployeeId;
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            logger.LogInformation("Assigned {Count} team members to project {ProjectId}", members.Count, projectId);
            return Result.Success((projectManagerId, superintendentId));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to assign team members to project {ProjectId}", projectId);
            return Result.Failure<(Guid? ProjectManagerId, Guid? SuperintendentId)>(
                "Failed to create project assignments",
                "DATABASE_ERROR");
        }
    }

    private static AssignmentRole MapTeamMemberRole(string? role, out bool isProjectManager, out bool isSuperintendent)
    {
        isProjectManager = false;
        isSuperintendent = false;

        if (string.Equals(role, "Project Manager", StringComparison.OrdinalIgnoreCase))
        {
            isProjectManager = true;
            return AssignmentRole.Manager;
        }

        if (string.Equals(role, "Superintendent", StringComparison.OrdinalIgnoreCase))
        {
            isSuperintendent = true;
            return AssignmentRole.Supervisor;
        }

        return AssignmentRole.Worker;
    }
}