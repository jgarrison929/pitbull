using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Services;

public record ProjectTeamMemberRequest(
    Guid EmployeeId,
    string? Role,
    AssignmentRole AssignmentRole = AssignmentRole.Worker);

public interface IProjectTeamAssignmentService
{
    Task<Result<(Guid? ProjectManagerId, Guid? SuperintendentId)>> AssignTeamMembersAsync(
        Guid projectId,
        IReadOnlyList<ProjectTeamMemberRequest> members,
        DateTime? projectStartDate,
        CancellationToken cancellationToken = default);
}