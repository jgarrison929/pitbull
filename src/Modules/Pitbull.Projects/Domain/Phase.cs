using Pitbull.Core.Domain;

namespace Pitbull.Projects.Domain;

/// <summary>
/// Project phase with cost code tracking.
/// Phases break a project into trackable segments (e.g., Foundation, Framing, MEP).
/// </summary>
public class Phase : BaseEntity
{
    public Guid ProjectId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string CostCode { get; set; } = string.Empty; // e.g. "03-100" (concrete)
    public string? Description { get; set; }
    public int SortOrder { get; set; }

    public decimal BudgetAmount { get; set; }
    public decimal ActualCost { get; set; }

    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public decimal PercentComplete { get; set; }

    public PhaseStatus Status { get; set; } = PhaseStatus.NotStarted;

    // Navigation
    public Project Project { get; set; } = null!;
}

public enum PhaseStatus
{
    NotStarted,
    InProgress,
    Completed,
    OnHold
}
