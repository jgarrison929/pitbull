using Pitbull.Bids.Domain;

namespace Pitbull.Bids.Features;

public record BidDto(
    Guid Id,
    string Name,
    string Number,
    BidStatus Status,
    decimal EstimatedValue,
    DateTime? BidDate,
    DateTime? DueDate,
    string? Owner,
    string? Description,
    Guid? ProjectId,
    IReadOnlyList<BidItemDto> Items,
    DateTime CreatedAt
);

public record BidItemDto(
    Guid Id,
    string Description,
    BidItemCategory Category,
    decimal Quantity,
    decimal UnitCost,
    decimal TotalCost
);
