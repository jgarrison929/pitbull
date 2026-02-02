using Pitbull.Core.Domain;

namespace Pitbull.Projects.Domain;

/// <summary>
/// Overall project budget summary. One-to-one with Project.
/// Tracks original contract, change orders, and current budget.
/// </summary>
public class ProjectBudget : BaseEntity
{
    public Guid ProjectId { get; set; }

    public decimal OriginalContractAmount { get; set; }
    public decimal ApprovedChangeOrders { get; set; }
    public decimal PendingChangeOrders { get; set; }
    public decimal CurrentContractAmount => OriginalContractAmount + ApprovedChangeOrders;

    public decimal TotalBudget { get; set; }
    public decimal TotalCommitted { get; set; }
    public decimal TotalActualCost { get; set; }
    public decimal TotalBilledToDate { get; set; }
    public decimal TotalReceivedToDate { get; set; }

    public decimal BudgetVariance => TotalBudget - TotalActualCost;
    public decimal RetainageHeld { get; set; }

    // Navigation
    public Project Project { get; set; } = null!;
}
