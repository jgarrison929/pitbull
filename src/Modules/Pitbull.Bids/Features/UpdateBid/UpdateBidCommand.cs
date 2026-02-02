using Pitbull.Bids.Domain;
using Pitbull.Bids.Features.CreateBid;
using Pitbull.Core.CQRS;

namespace Pitbull.Bids.Features.UpdateBid;

public record UpdateBidCommand(
    Guid Id,
    string Name,
    string Number,
    BidStatus Status,
    decimal EstimatedValue,
    DateTime? BidDate,
    DateTime? DueDate,
    string? Owner,
    string? Description,
    List<CreateBidItemDto>? Items
) : ICommand<BidDto>;
