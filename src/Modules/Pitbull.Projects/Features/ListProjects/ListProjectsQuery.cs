using Pitbull.Core.CQRS;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;

namespace Pitbull.Projects.Features.ListProjects;

public record ListProjectsQuery(
    ProjectStatus? Status = null,
    ProjectType? Type = null,
    string? Search = null,
    int Page = 1,
    int PageSize = 25
) : IQuery<PagedResult<ProjectDto>>;

public record PagedResult<T>(
    IReadOnlyList<T> Items,
    int TotalCount,
    int Page,
    int PageSize
)
{
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
}
