using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Bids.Domain;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Bids.Features.ListBids;

public class ListBidsHandler(PitbullDbContext db)
    : IRequestHandler<ListBidsQuery, Result<PagedBidResult>>
{
    public async Task<Result<PagedBidResult>> Handle(
        ListBidsQuery request, CancellationToken cancellationToken)
    {
        var query = db.Set<Bid>()
            .AsNoTracking()
            .Include(b => b.Items)
            .AsQueryable();

        if (request.Status.HasValue)
            query = query.Where(b => b.Status == request.Status.Value);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.ToLower();
            query = query.Where(b =>
                b.Name.ToLower().Contains(search) ||
                b.Number.ToLower().Contains(search) ||
                (b.Owner != null && b.Owner.ToLower().Contains(search)));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(b => b.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(BidMapper.ToDto).ToList();

        return Result.Success(new PagedBidResult(
            dtos, totalCount, request.Page, request.PageSize));
    }
}
