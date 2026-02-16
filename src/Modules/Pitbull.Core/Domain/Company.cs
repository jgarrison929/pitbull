namespace Pitbull.Core.Domain;

/// <summary>
/// A legal entity/company within a tenant.
/// Each company has its own financials, projects, and reporting.
/// Replaces the old CompanySettings entity.
/// </summary>
public class Company : BaseEntity
{
    /// <summary>
    /// Short numeric or alpha code for the company (e.g., "01", "GGC", "CONC").
    /// Used in project numbering, reports, and company switcher.
    /// Unique within a tenant.
    /// </summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>
    /// Full legal name (e.g., "Garrison General Contractors LLC")
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Short display name for UI (e.g., "Garrison GC")
    /// </summary>
    public string? ShortName { get; set; }

    /// <summary>
    /// Federal Tax ID / EIN
    /// </summary>
    public string? TaxId { get; set; }

    // Address
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? ZipCode { get; set; }

    // Contact
    public string? Phone { get; set; }
    public string? Website { get; set; }
    public string? Email { get; set; }

    // Branding
    public string? LogoUrl { get; set; }
    public string? PrimaryColor { get; set; }

    // Financial settings
    public string Currency { get; set; } = "USD";
    public string Timezone { get; set; } = "America/Los_Angeles";
    public string DateFormat { get; set; } = "MM/dd/yyyy";
    public int FiscalYearStartMonth { get; set; } = 1;

    /// <summary>
    /// Whether this company is active and accessible
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Sort order in company switcher
    /// </summary>
    public int SortOrder { get; set; }

    /// <summary>
    /// Whether this is the default company for new users in this tenant
    /// </summary>
    public bool IsDefault { get; set; }

    /// <summary>
    /// JSONB column for company-specific settings
    /// </summary>
    public string Settings { get; set; } = "{}";

    /// <summary>
    /// Timecard configuration for crew entry grid.
    /// Stored as owned entity (mapped to columns on the companies table).
    /// </summary>
    public TimecardSettings TimecardSettings { get; set; } = new();
}
