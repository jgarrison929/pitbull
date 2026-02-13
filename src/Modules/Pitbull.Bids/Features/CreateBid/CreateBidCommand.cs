using Pitbull.Bids.Features.Shared;
using Pitbull.Bids.Domain;
using Pitbull.Core.CQRS;

namespace Pitbull.Bids.Features.CreateBid;

public record CreateBidCommand(
    string Name,
    string Number,
    decimal EstimatedValue,
    DateTime? BidDate,
    DateTime? DueDate,
    string? Owner,
    string? Description,
    List<CreateBidItemDto>? Items
) : ICommand<BidDto>;

public record CreateBidItemDto(
    string Description,
    BidItemCategory Category,
    decimal Quantity,
    decimal UnitCost
);
