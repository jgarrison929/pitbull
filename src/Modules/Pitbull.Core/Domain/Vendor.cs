namespace Pitbull.Core.Domain;

/// <summary>
/// AP vendor master.
/// </summary>
public class Vendor : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }

    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? TaxId { get; set; }

    public string? ContactName { get; set; }
    public string? ContactEmail { get; set; }
    public string? Phone { get; set; }

    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Zip { get; set; }

    public DateOnly? InsuranceExpDate { get; set; }
    public bool W9OnFile { get; set; }

    public string? MinorityWbeStatus { get; set; }
    public string? TradeClassification { get; set; }
    public string? PaymentTerms { get; set; }

    public bool IsActive { get; set; } = true;
}
