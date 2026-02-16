namespace Pitbull.TimeTracking.Messages;

public class TimeEntriesApproved
{
    public Guid BatchId { get; set; }
    public Guid ApprovedById { get; set; }
    public List<Guid> TimeEntryIds { get; set; } = [];
    public int Count { get; set; }
    public DateTime ApprovedAt { get; set; }
}
