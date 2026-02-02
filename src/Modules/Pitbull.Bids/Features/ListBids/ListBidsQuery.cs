using Pitbull.Bids.Domain;
using Pitbull.Core.CQRS;

namespace Pitbull.Bids.Features.ListBids;

public record ListBidsQuery(
    BidStatus? Status = null,
    string? Search = null,
    int Page = 1,
    int PageSize = 25
) : IQuery<PagedBidResult>;

public record PagedBidResult(
    IReadOnlyList<BidDto> Items,
    int TotalCount,
    int Page,
    int PageSize
)
{
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
}
