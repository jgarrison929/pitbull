namespace Pitbull.TimeTracking.Messages;

public record TimeEntriesDraftSaved
{
    public Guid BatchId { get; init; }
    public Guid SavedById { get; init; }
    public int Count { get; init; }
    public DateTime SavedAt { get; init; }
}
