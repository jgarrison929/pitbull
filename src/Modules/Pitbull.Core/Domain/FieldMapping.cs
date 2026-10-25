using Pitbull.Core.Domain;

namespace Pitbull.Core.Domain;

/// <summary>
/// Maps a source column from a legacy ERP export to a Pitbull target field.
/// Part of a MigrationProject's field mapping configuration.
/// </summary>
public class FieldMapping : BaseEntity, ITenantScoped
{
    /// <summary>
    /// The migration project this mapping belongs to
    /// </summary>
    public Guid MigrationProjectId { get; set; }

    /// <summary>
    /// Target entity type: "vendor", "project", "employee", "cost-code", "gl-account", etc.
    /// </summary>
    public string EntityType { get; set; } = string.Empty;

    /// <summary>
    /// Column name from the source CSV/Excel file
    /// </summary>
    public string SourceColumn { get; set; } = string.Empty;

    /// <summary>
    /// Pitbull entity property name this maps to
    /// </summary>
    public string TargetField { get; set; } = string.Empty;

    /// <summary>
    /// Transformation to apply: "uppercase", "trim", "date:MM/dd/yyyy", "value-map:{json}", etc.
    /// Null means direct copy (no transformation).
    /// </summary>
    public string? TransformRule { get; set; }

    /// <summary>
    /// Whether this field must have a value for the row to be valid
    /// </summary>
    public bool IsRequired { get; set; }

    /// <summary>
    /// Display order in the mapping UI
    /// </summary>
    public int SortOrder { get; set; }

    // Navigation
    public MigrationProject MigrationProject { get; set; } = null!;
}
