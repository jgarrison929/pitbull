using Pitbull.Core.CQRS;

namespace Pitbull.Bids.Features.DeleteBid;

public record DeleteBidCommand(Guid Id) : ICommand<bool>;
