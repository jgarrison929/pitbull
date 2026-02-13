namespace Pitbull.Core.Domain;

/// <summary>
/// Cost codes for job cost accounting and budget tracking.
/// Foundation for the bid-to-project conversion workflow.
/// </summary>
public class CostCode : BaseEntity
{
    public required string Code { get; set; }
    public required string Description { get; set; }
    public string? Division { get; set; } // CSI division (optional)
    public CostType CostType { get; set; } = CostType.Labor;
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Whether this is a company-wide standard cost code or project-specific override
    /// </summary>
    public bool IsCompanyStandard { get; set; } = true;

    /// <summary>
    /// Optional parent cost code for hierarchical organization
    /// </summary>
    public Guid? ParentCostCodeId { get; set; }
    public CostCode? ParentCostCode { get; set; }

    /// <summary>
    /// Child cost codes (sub-codes)
    /// </summary>
    public List<CostCode> ChildCostCodes { get; set; } = [];
}

/// <summary>
/// Standard cost types for construction accounting
/// </summary>
public enum CostType
{
    Labor = 1,
    Material = 2,
    Equipment = 3,
    Subcontract = 4,
    Other = 5
}
