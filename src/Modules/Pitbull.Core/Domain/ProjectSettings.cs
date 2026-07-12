namespace Pitbull.Core.Domain;

/// <summary>
/// Company-level project configuration defaults. Owned by Company entity.
/// Controls project numbering, budget rules, phase auto-creation, and retention.
/// </summary>
public class ProjectSettings
{
    /// <summary>
    /// Default project number format (e.g., "YYYY-####", "PRJ-####").
    /// Used as template when auto-generating project numbers.
    /// </summary>
    public string DefaultNumberingFormat { get; set; } = "YYYY-####";

    /// <summary>
    /// Require a budget to be entered before a project can be activated.
    /// Prevents starting work without financial planning.
    /// </summary>
    public bool RequireBudgetBeforeActivation { get; set; } = false;

    /// <summary>
    /// Automatically create standard phases (e.g., Preconstruction, Construction, Closeout)
    /// when a new project is created.
    /// </summary>
    public bool AutoCreatePhases { get; set; } = true;

    /// <summary>
    /// Default retention percentage held on project pay applications.
    /// Industry standard is typically 5-10%.
    /// </summary>
    public decimal DefaultRetentionPercent { get; set; } = 10m;

    /// <summary>
    /// When true, field progress / daily report submissions should require a spatial zone
    /// (or equivalent spatial ref) for non-demo paths. Default off — optional company setting.
    /// Enforcement UX lands in later 2.18.x; schema only until then.
    /// </summary>
    public bool RequireSpatialOnProgress { get; set; } = false;
}
