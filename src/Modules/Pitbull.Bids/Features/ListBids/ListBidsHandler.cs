using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Bids.Domain;
using Pitbull.Bids.Features.Shared;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Bids.Features.ListBids;

public sealed class ListBidsHandler(PitbullDbContext db)
    : IRequestHandler<ListBidsQuery, Result<PagedResult<BidDto>>>
{
    public async Task<Result<PagedResult<BidDto>>> Handle(
        ListBidsQuery request, CancellationToken cancellationToken)
    {
        var query = db.Set<Bid>()
            .AsNoTracking()
            .Include(b => b.Items)
            .Where(b => !b.IsDeleted)
            .AsQueryable();

        if (request.Status.HasValue)
            query = query.Where(b => b.Status == request.Status.Value);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.ToLower();
            query = query.Where(b =>
                b.Name.Contains(search, StringComparison.CurrentCultureIgnoreCase) ||
                b.Number.ToLower().Contains(search) ||
                (b.Owner != null && b.Owner.Contains(search, StringComparison.CurrentCultureIgnoreCase)));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(b => b.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(BidMapper.ToDto).ToList();

        return Result.Success(new PagedResult<BidDto>(
            dtos, totalCount, request.Page, request.PageSize));
    }
}
