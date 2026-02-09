namespace Pitbull.Core.Domain;

/// <summary>
/// Company-specific settings that customize the application behavior.
/// One per tenant.
/// </summary>
public class CompanySettings : BaseEntity
{
    /// <summary>Company display name</summary>
    public string CompanyName { get; set; } = string.Empty;
    
    /// <summary>URL to company logo (stored in blob storage)</summary>
    public string? LogoUrl { get; set; }
    
    /// <summary>Company physical address</summary>
    public string? Address { get; set; }
    
    /// <summary>City</summary>
    public string? City { get; set; }
    
    /// <summary>State/Province</summary>
    public string? State { get; set; }
    
    /// <summary>ZIP/Postal code</summary>
    public string? ZipCode { get; set; }
    
    /// <summary>Country</summary>
    public string? Country { get; set; }
    
    /// <summary>Main phone number</summary>
    public string? Phone { get; set; }
    
    /// <summary>Company website</summary>
    public string? Website { get; set; }
    
    /// <summary>Tax ID / EIN</summary>
    public string? TaxId { get; set; }
    
    // Preferences
    
    /// <summary>IANA timezone identifier (e.g., "America/Los_Angeles")</summary>
    public string Timezone { get; set; } = "America/Los_Angeles";
    
    /// <summary>Date format for display (e.g., "MM/dd/yyyy" or "dd/MM/yyyy")</summary>
    public string DateFormat { get; set; } = "MM/dd/yyyy";
    
    /// <summary>Time format (12h or 24h)</summary>
    public string TimeFormat { get; set; } = "12h";
    
    /// <summary>Currency code (e.g., "USD", "CAD")</summary>
    public string Currency { get; set; } = "USD";
    
    /// <summary>First month of fiscal year (1-12)</summary>
    public int FiscalYearStartMonth { get; set; } = 1;
    
    /// <summary>Working days of the week (comma-separated: "Mon,Tue,Wed,Thu,Fri")</summary>
    public string WorkWeek { get; set; } = "Mon,Tue,Wed,Thu,Fri";
    
    /// <summary>Default working hours per day</summary>
    public decimal DefaultWorkHoursPerDay { get; set; } = 8;
    
    /// <summary>Default overtime threshold (hours per week)</summary>
    public decimal OvertimeThresholdWeekly { get; set; } = 40;
    
    // Email/Notification Settings
    
    /// <summary>Email address for system notifications</summary>
    public string? NotificationEmail { get; set; }
    
    /// <summary>Enable email notifications</summary>
    public bool EmailNotificationsEnabled { get; set; } = true;
    
    /// <summary>Digest frequency: immediate, daily, weekly</summary>
    public string DigestFrequency { get; set; } = "immediate";
}
