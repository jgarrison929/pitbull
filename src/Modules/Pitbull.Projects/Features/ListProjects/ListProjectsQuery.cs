using Pitbull.Core.CQRS;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;

namespace Pitbull.Projects.Features.ListProjects;

public record ListProjectsQuery(
    ProjectStatus? Status = null,
    ProjectType? Type = null,
    string? Search = null
) : PaginationQuery, IQuery<PagedResult<ProjectDto>>;
