namespace Pitbull.Core.Domain;

/// <summary>
/// Tenant-level company settings and preferences
/// </summary>
public class CompanySettings : BaseEntity
{
    public string CompanyName { get; private set; } = string.Empty;
    public string? LogoUrl { get; private set; }
    public string? PrimaryColor { get; private set; }
    public string? Address { get; private set; }
    public string? City { get; private set; }
    public string? State { get; private set; }
    public string? ZipCode { get; private set; }
    public string? Phone { get; private set; }
    public string? Website { get; private set; }
    public string? TaxId { get; private set; }
    public string Timezone { get; private set; } = "America/Los_Angeles";
    public string DateFormat { get; private set; } = "MM/dd/yyyy";
    public string Currency { get; private set; } = "USD";
    public int FiscalYearStartMonth { get; private set; } = 1;

    private CompanySettings() { }

    public static CompanySettings Create(Guid tenantId, string companyName)
    {
        return new CompanySettings
        {
            TenantId = tenantId,
            CompanyName = companyName
        };
    }

    public void Update(
        string companyName,
        string? logoUrl,
        string? primaryColor,
        string? address,
        string? city,
        string? state,
        string? zipCode,
        string? phone,
        string? website,
        string? taxId,
        string timezone,
        string dateFormat,
        string currency,
        int fiscalYearStartMonth)
    {
        CompanyName = companyName;
        LogoUrl = logoUrl;
        PrimaryColor = primaryColor;
        Address = address;
        City = city;
        State = state;
        ZipCode = zipCode;
        Phone = phone;
        Website = website;
        TaxId = taxId;
        Timezone = timezone;
        DateFormat = dateFormat;
        Currency = currency;
        FiscalYearStartMonth = fiscalYearStartMonth;
    }
}
