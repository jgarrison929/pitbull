namespace Pitbull.Bids.Domain;

public enum BidStatus
{
    Draft = 0,
    Submitted = 1,
    Won = 2,
    Lost = 3,
    NoResponse = 4,
    NoBid = NoResponse, // backward-compatible alias
    Cancelled = 5
}
