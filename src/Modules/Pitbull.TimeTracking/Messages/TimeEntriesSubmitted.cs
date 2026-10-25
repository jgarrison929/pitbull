namespace Pitbull.TimeTracking.Messages;

public record TimeEntriesSubmitted
{
    public Guid BatchId { get; init; }
    public Guid SubmittedById { get; init; }
    public List<Guid> TimeEntryIds { get; init; } = [];
    public int Count { get; init; }
    public DateTime SubmittedAt { get; init; }
}
