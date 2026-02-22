using Pitbull.Core.Domain;

namespace Pitbull.Notifications.Domain;

public class Notification : BaseEntity
{
    public Guid UserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public NotificationType Type { get; set; } = NotificationType.Info;
    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }
    public string? RelatedEntityType { get; set; }
    public Guid? RelatedEntityId { get; set; }
}

public enum NotificationType
{
    Info,
    Success,
    Warning,
    Error,
    TimeEntrySubmitted,
    TimeEntryApproved,
    TimeEntryRejected,
    PendingApproval,
    ChangeOrder,
    OverdueRfi,
    UpcomingRfi,
    OverdueSubmittal,
    UpcomingSubmittal,
    RfiCreated,
    RfiAnswered,
    SystemUpdate,
    RetentionDeadline,
    InspectionDeadline,
    SubmittalReviewStale
}
