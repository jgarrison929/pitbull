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
    
    // Document references
    public string? SpecSection { get; set; }        // CSI format: "03 30 00 - Cast-in-Place Concrete"
    public string? DrawingReferences { get; set; }  // JSON array: ["S-101", "S-102", "D-001"]
    
    // Cost impact tracking
    public bool HasCostImpact { get; set; }
    public decimal? EstimatedCostImpact { get; set; }
    public int? EstimatedDelayDays { get; set; }
    
    // AI assistance
    public string? AiSuggestedAnswer { get; set; }
    public DateTime? AiAnalyzedAt { get; set; }
}