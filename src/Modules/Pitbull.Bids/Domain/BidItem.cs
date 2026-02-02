using Pitbull.Core.Domain;

namespace Pitbull.Bids.Domain;

/// <summary>
/// Line item on a bid with cost categorization.
/// </summary>
public class BidItem : BaseEntity
{
    public Guid BidId { get; set; }
    public string Description { get; set; } = string.Empty;
    public BidItemCategory Category { get; set; } = BidItemCategory.Other;
    public decimal Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public decimal TotalCost { get; set; }

    // Navigation
    public Bid Bid { get; set; } = null!;
}
