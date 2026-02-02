using Pitbull.Bids.Domain;

namespace Pitbull.Bids.Features;

internal static class BidMapper
{
    public static BidDto ToDto(Bid bid) => new(
        bid.Id,
        bid.Name,
        bid.Number,
        bid.Status,
        bid.EstimatedValue,
        bid.BidDate,
        bid.DueDate,
        bid.Owner,
        bid.Description,
        bid.ProjectId,
        bid.Items.Select(i => new BidItemDto(
            i.Id, i.Description, i.Category,
            i.Quantity, i.UnitCost, i.TotalCost
        )).ToList(),
        bid.CreatedAt
    );
}
