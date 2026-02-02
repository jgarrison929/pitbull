using Pitbull.Core.Domain;

namespace Pitbull.RFIs.Domain;

/// <summary>
/// Request for Information (RFI) - formal question about construction documents
/// </summary>
public class Rfi : BaseEntity
{
    public int Number { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string Question { get; set; } = string.Empty;
    public string? Answer { get; set; }
    public RfiStatus Status { get; set; } = RfiStatus.Open;
    public RfiPriority Priority { get; set; } = RfiPriority.Normal;
    public DateTime? DueDate { get; set; }
    public DateTime? AnsweredAt { get; set; }
    public DateTime? ClosedAt { get; set; }

    // Required project link
    public Guid ProjectId { get; set; }

    // Ball-in-court tracking
    public Guid? BallInCourtUserId { get; set; }
    public string? BallInCourtName { get; set; }

    // Assignment tracking
    public Guid? AssignedToUserId { get; set; }
    public string? AssignedToName { get; set; }
    
    public string? CreatedByName { get; set; }
}