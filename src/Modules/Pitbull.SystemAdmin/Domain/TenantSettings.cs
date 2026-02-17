using Pitbull.Core.Domain;

namespace Pitbull.SystemAdmin.Domain;

/// <summary>
/// Persisted tenant-level settings (company info, locale, branding).
/// One row per tenant — upserted on save.
/// </summary>
public class TenantSettings : BaseEntity
{
    // Company Info
    public string CompanyName { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public string? PrimaryColor { get; set; }

    // Address
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? ZipCode { get; set; }
    public string? Phone { get; set; }
    public string? Website { get; set; }
    public string? TaxId { get; set; }

    // Locale / Preferences
    public string Timezone { get; set; } = "America/Los_Angeles";
    public string DateFormat { get; set; } = "MM/dd/yyyy";
    public string Currency { get; set; } = "USD";
    public int FiscalYearStartMonth { get; set; } = 1;

    // Feature Flags
    public bool EnableTimeTracking { get; set; } = true;
    public bool EnableBidManagement { get; set; } = true;
    public bool EnableDocumentManagement { get; set; } = true;
    public bool EnableSubcontractorPortal { get; set; } = false;
}
