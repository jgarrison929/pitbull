using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.RFIs.Domain;

namespace Pitbull.RFIs.Features.ListRfis;

public sealed class ListRfisHandler(PitbullDbContext db) : IRequestHandler<ListRfisQuery, Result<PagedResult<RfiDto>>>
{
    public async Task<Result<PagedResult<RfiDto>>> Handle(ListRfisQuery request, CancellationToken cancellationToken)
    {
        var query = db.Set<Rfi>()
            .AsNoTracking()
            .Where(r => r.ProjectId == request.ProjectId && !r.IsDeleted)
            .AsQueryable();

        if (request.Status.HasValue)
            query = query.Where(r => r.Status == request.Status.Value);

        if (request.Priority.HasValue)
            query = query.Where(r => r.Priority == request.Priority.Value);

        if (request.BallInCourtUserId.HasValue)
            query = query.Where(r => r.BallInCourtUserId == request.BallInCourtUserId.Value);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.ToLower();
            query = query.Where(r =>
                r.Subject.ToLower().Contains(search) ||
                r.Question.ToLower().Contains(search) ||
                (r.AssignedToName != null && r.AssignedToName.ToLower().Contains(search)));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(r => r.Number)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(RfiMapper.ToDto).ToList();

        return Result.Success(new PagedResult<RfiDto>(dtos, totalCount, request.Page, request.PageSize));
    }
}