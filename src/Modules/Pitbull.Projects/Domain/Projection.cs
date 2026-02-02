using Pitbull.Core.Domain;

namespace Pitbull.Projects.Domain;

/// <summary>
/// Monthly/periodic financial projection for a project.
/// Used for cash flow forecasting and earned value analysis.
/// </summary>
public class Projection : BaseEntity
{
    public Guid ProjectId { get; set; }
    public DateTime PeriodStart { get; set; }
    public DateTime PeriodEnd { get; set; }

    public decimal ProjectedRevenue { get; set; }
    public decimal ProjectedCost { get; set; }
    public decimal ActualRevenue { get; set; }
    public decimal ActualCost { get; set; }

    public decimal ProjectedMargin => ProjectedRevenue - ProjectedCost;
    public decimal ActualMargin => ActualRevenue - ActualCost;

    public string? Notes { get; set; }

    // Navigation
    public Project Project { get; set; } = null!;
}
