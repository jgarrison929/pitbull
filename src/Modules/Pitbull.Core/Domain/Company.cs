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

    // Classification
    /// <summary>
    /// Industry type slug (e.g., "general-contractor", "specialty-contractor").
    /// Collected during signup; stored as a plain string for flexibility.
    /// </summary>
    public string? IndustryType { get; set; }

    /// <summary>
    /// Employee range label (e.g., "1-10", "11-50", "500+").
    /// Collected during signup; stored as a plain string for flexibility.
    /// </summary>
    public string? EmployeeRange { get; set; }

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
    /// Pay period frequency: Weekly, BiWeekly, SemiMonthly, Monthly.
    /// Stored as string to avoid cross-module dependency on TimeTracking.
    /// </summary>
    public string PayPeriodType { get; set; } = "Weekly";

    /// <summary>
    /// Default work week days as comma-separated values (e.g., "Mon,Tue,Wed,Thu,Fri").
    /// </summary>
    public string DefaultWorkWeekDays { get; set; } = "Mon,Tue,Wed,Thu,Fri";

    /// <summary>
    /// JSONB column for company-specific settings
    /// </summary>
    public string Settings { get; set; } = "{}";

    /// <summary>
    /// Timecard configuration for crew entry grid.
    /// Stored as owned entity (mapped to columns on the companies table).
    /// </summary>
    public TimecardSettings TimecardSettings { get; set; } = new();

    /// <summary>
    /// Overtime calculation rules.
    /// Stored as owned entity (mapped to columns on the companies table).
    /// </summary>
    public OvertimeSettings OvertimeSettings { get; set; } = new();

    /// <summary>
    /// Payment application workflow and retainage defaults.
    /// Stored as owned entity (mapped to columns on the companies table).
    /// </summary>
    public PaymentApplicationSettings PaymentApplicationSettings { get; set; } = new();

    /// <summary>
    /// Employee onboarding workflow configuration.
    /// Stored as owned entity (mapped to columns on the companies table).
    /// </summary>
    public EmployeeOnboardingSettings EmployeeOnboardingSettings { get; set; } = new();

    /// <summary>
    /// Project numbering, budget, and phase configuration.
    /// Stored as owned entity (mapped to columns on the companies table).
    /// </summary>
    public ProjectSettings ProjectSettings { get; set; } = new();

    /// <summary>
    /// Subcontract retainage, approval workflow, and AIA form defaults.
    /// Stored as owned entity (mapped to columns on the companies table).
    /// </summary>
    public ContractSettings ContractSettings { get; set; } = new();

    /// <summary>
    /// Bid validity, estimator sign-off, and markup defaults.
    /// Stored as owned entity (mapped to columns on the companies table).
    /// </summary>
    public BidSettings BidSettings { get; set; } = new();

    /// <summary>
    /// RFI response deadlines, auto-assignment, and cost impact rules.
    /// Stored as owned entity (mapped to columns on the companies table).
    /// </summary>
    public RfiSettings RfiSettings { get; set; } = new();

    /// <summary>
    /// Report branding, overtime rules, and fiscal year configuration.
    /// Stored as owned entity (mapped to columns on the companies table).
    /// </summary>
    public ReportSettings ReportSettings { get; set; } = new();
}
