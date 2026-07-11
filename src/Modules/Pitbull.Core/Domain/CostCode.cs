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
/// Job-cost cost class (not GL account type).
/// How supers/controllers classify a cost: self-perform L/M/E, sub L/M/3rd party, overhead.
/// Integer values are stable for persisted CostCodes.CostType columns — never renumber.
/// </summary>
public enum CostType
{
    Labor = 1,
    Material = 2,
    Equipment = 3,
    /// <summary>Legacy umbrella for sub costs. Prefer SubLabor / SubMaterial / SubThirdParty for new codes.</summary>
    Subcontract = 4,
    Other = 5,
    Overhead = 6,
    SubLabor = 7,
    SubMaterial = 8,
    /// <summary>Sub third-party / specialty (e.g. testing, haul-off, hired sub equipment).</summary>
    SubThirdParty = 9,
}

/// <summary>
/// Super-facing labels for cost types. API CostTypeName uses these so clients never invent strings.
/// </summary>
public static class CostTypeLabels
{
    public static string DisplayName(CostType type) => type switch
    {
        CostType.Labor => "Labor",
        CostType.Material => "Material",
        CostType.Equipment => "Equipment",
        CostType.Subcontract => "Sub (general)",
        CostType.Other => "Other",
        CostType.Overhead => "Overhead",
        CostType.SubLabor => "Sub Labor",
        CostType.SubMaterial => "Sub Material",
        CostType.SubThirdParty => "Sub Third Party",
        _ => type.ToString(),
    };

    /// <summary>True for any sub-related class (legacy Subcontract + split types).</summary>
    public static bool IsSubRelated(CostType type) =>
        type is CostType.Subcontract
            or CostType.SubLabor
            or CostType.SubMaterial
            or CostType.SubThirdParty;
}
