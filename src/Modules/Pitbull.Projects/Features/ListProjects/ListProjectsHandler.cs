using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;

namespace Pitbull.Projects.Features.ListProjects;

public class ListProjectsHandler(PitbullDbContext db)
    : IRequestHandler<ListProjectsQuery, Result<PagedResult<ProjectDto>>>
{
    public async Task<Result<PagedResult<ProjectDto>>> Handle(
        ListProjectsQuery request, CancellationToken cancellationToken)
    {
        var query = db.Set<Project>().AsNoTracking().AsQueryable();

        if (request.Status.HasValue)
            query = query.Where(p => p.Status == request.Status.Value);

        if (request.Type.HasValue)
            query = query.Where(p => p.Type == request.Type.Value);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.ToLower();
            query = query.Where(p =>
                p.Name.ToLower().Contains(search) ||
                p.Number.ToLower().Contains(search) ||
                (p.ClientName != null && p.ClientName.ToLower().Contains(search)));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(p => p.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(CreateProjectHandler.MapToDto).ToList();

        return Result.Success(new PagedResult<ProjectDto>(
            dtos, totalCount, request.Page, request.PageSize));
    }
}
