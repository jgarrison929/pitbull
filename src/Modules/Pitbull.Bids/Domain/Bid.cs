using Pitbull.Core.Domain;

namespace Pitbull.Bids.Domain;

/// <summary>
/// A bid/estimate for a potential construction project.
/// Can be converted to a Project when won.
/// </summary>
public class Bid : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Number { get; set; } = string.Empty; // e.g. "BID-2026-001"
    public BidStatus Status { get; set; } = BidStatus.Draft;
    public decimal EstimatedValue { get; set; }
    public DateTime? BidDate { get; set; }
    public DateTime? DueDate { get; set; }
    public string? Owner { get; set; }
    public string? Description { get; set; }

    // Optional link to project (set when converted)
    public Guid? ProjectId { get; set; }

    // Navigation
    public ICollection<BidItem> Items { get; set; } = [];
}
