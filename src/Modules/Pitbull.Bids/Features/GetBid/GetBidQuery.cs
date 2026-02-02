using Pitbull.Core.CQRS;

namespace Pitbull.Bids.Features.GetBid;

public record GetBidQuery(Guid Id) : IQuery<BidDto>;
