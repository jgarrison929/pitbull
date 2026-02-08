using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Bids.Domain;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Bids.Features.GetBid;

public sealed class GetBidHandler(PitbullDbContext db)
    : IRequestHandler<GetBidQuery, Result<BidDto>>
{
    public async Task<Result<BidDto>> Handle(
        GetBidQuery request, CancellationToken cancellationToken)
    {
        var bid = await db.Set<Bid>()
            .AsNoTracking()
            .Include(b => b.Items)
            .FirstOrDefaultAsync(b => b.Id == request.Id && !b.IsDeleted, cancellationToken);

        if (bid is null)
            return Result.Failure<BidDto>("Bid not found", "NOT_FOUND");

        return Result.Success(BidMapper.ToDto(bid));
    }
}
