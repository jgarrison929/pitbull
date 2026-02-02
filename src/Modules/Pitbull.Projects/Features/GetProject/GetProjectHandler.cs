using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;

namespace Pitbull.Projects.Features.GetProject;

public class GetProjectHandler(PitbullDbContext db)
    : IRequestHandler<GetProjectQuery, Result<ProjectDto>>
{
    public async Task<Result<ProjectDto>> Handle(
        GetProjectQuery request, CancellationToken cancellationToken)
    {
        var project = await db.Set<Project>()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);

        if (project is null)
            return Result.Failure<ProjectDto>("Project not found", "NOT_FOUND");

        return Result.Success(CreateProjectHandler.MapToDto(project));
    }
}
