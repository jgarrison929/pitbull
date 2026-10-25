namespace Pitbull.TimeTracking.Messages;

public class TimeEntriesRejected
{
    public Guid BatchId { get; set; }
    public Guid RejectedById { get; set; }
    public List<Guid> TimeEntryIds { get; set; } = [];
    public int Count { get; set; }
    public DateTime RejectedAt { get; set; }
}
