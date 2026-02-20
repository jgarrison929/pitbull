using Pitbull.Core.Domain;

namespace Pitbull.Core.Entities;

public enum FeedbackStatus
{
    New = 0,
    Reviewed = 1,
    Resolved = 2
}

public class Feedback : BaseEntity
{
    public string Page { get; set; } = string.Empty;
    public string UserRole { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? ContactEmail { get; set; }
    public FeedbackStatus Status { get; set; } = FeedbackStatus.New;
}
