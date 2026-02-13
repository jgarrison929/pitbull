using Pitbull.Bids.Features.Shared;
using Pitbull.Bids.Domain;
using Pitbull.Core.CQRS;

namespace Pitbull.Bids.Features.ListBids;

public record ListBidsQuery(
    BidStatus? Status = null,
    string? Search = null
) : PaginationQuery, IQuery<PagedResult<BidDto>>;
