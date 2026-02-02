using Pitbull.Core.CQRS;
using Pitbull.Projects.Features.CreateProject;

namespace Pitbull.Projects.Features.GetProject;

public record GetProjectQuery(Guid Id) : IQuery<ProjectDto>;
