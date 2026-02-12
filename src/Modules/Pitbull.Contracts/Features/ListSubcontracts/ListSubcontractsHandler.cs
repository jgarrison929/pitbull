using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreateSubcontract;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Contracts.Features.ListSubcontracts;

public sealed class ListSubcontractsHandler(PitbullDbContext db)
    : IRequestHandler<ListSubcontractsQuery, Result<PagedResult<SubcontractDto>>>
{
    public async Task<Result<PagedResult<SubcontractDto>>> Handle(
        ListSubcontractsQuery request, CancellationToken cancellationToken)
    {
        var query = db.Set<Subcontract>().AsNoTracking().Where(s => !s.IsDeleted);

        // Filter by project
        if (request.ProjectId.HasValue)
            query = query.Where(s => s.ProjectId == request.ProjectId.Value);

        // Filter by status
        if (request.Status.HasValue)
            query = query.Where(s => s.Status == request.Status.Value);

        // Search by subcontractor name or number
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.ToLower();
            query = query.Where(s =>
                s.SubcontractorName.Contains(search, StringComparison.CurrentCultureIgnoreCase) ||
                s.SubcontractNumber.ToLower().Contains(search));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(s => s.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(s => CreateSubcontractHandler.MapToDto(s))
            .ToListAsync(cancellationToken);

        return Result.Success(new PagedResult<SubcontractDto>(
            items, totalCount, request.Page, request.PageSize));
    }
}
