namespace Pitbull.Core.Domain;

/// <summary>
/// AR customer master.
/// </summary>
public class Customer : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }

    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;

    public string? ContactName { get; set; }
    public string? ContactEmail { get; set; }
    public string? Phone { get; set; }

    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Zip { get; set; }

    public string? PaymentTerms { get; set; }
    public decimal? CreditLimit { get; set; }

    public bool IsActive { get; set; } = true;
}
