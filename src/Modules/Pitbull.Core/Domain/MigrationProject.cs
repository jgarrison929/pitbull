using Pitbull.Core.Domain;

namespace Pitbull.Core.Domain;

/// <summary>
/// Tracks a multi-batch data migration from a legacy ERP system (Vista, Sage, QuickBooks, etc.).
/// The overall container for all import batches, field mappings, and reconciliation within a migration.
/// </summary>
public class MigrationProject : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }

    /// <summary>
    /// Human-readable name, e.g. "Vista Migration - February 2026"
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Source ERP system identifier: "vista", "sage300", "foundation", "quickbooks", "generic"
    /// </summary>
    public string SourceSystem { get; set; } = string.Empty;

    /// <summary>
    /// Detected or user-specified version of the source system, e.g. "Vista 6.0"
    /// </summary>
    public string? SourceVersion { get; set; }

    /// <summary>
    /// Current lifecycle status of the migration project
    /// </summary>
    public MigrationProjectStatus Status { get; set; } = MigrationProjectStatus.Draft;

    /// <summary>
    /// Summary statistics
    /// </summary>
    public int TotalRecords { get; set; }
    public int ImportedRecords { get; set; }
    public int FailedRecords { get; set; }

    /// <summary>
    /// JSON summary of validation errors and warnings from the most recent validation run
    /// </summary>
    public string? ValidationReport { get; set; }

    /// <summary>
    /// When the migration was completed or abandoned
    /// </summary>
    public DateTime? CompletedAt { get; set; }

    /// <summary>
    /// Optional notes about the migration
    /// </summary>
    public string? Notes { get; set; }

    // Navigation
    public ICollection<FieldMapping> FieldMappings { get; set; } = [];
}

public enum MigrationProjectStatus
{
    Draft,
    InProgress,
    Validated,
    Complete,
    Failed,
    Abandoned
}
