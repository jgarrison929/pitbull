using Pitbull.Core.Domain;

namespace Pitbull.Billing.Domain;

/// <summary>
/// Tax jurisdiction — a geographic area with its own tax rates.
/// Supports state, county, and city jurisdictions with combined rates.
/// </summary>
public class TaxJurisdiction : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }

    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? State { get; set; }
    public string? County { get; set; }
    public string? City { get; set; }

    /// <summary>Combined tax rate for this jurisdiction (state + county + city).</summary>
    public decimal CombinedRate { get; set; }

    public decimal StateRate { get; set; }
    public decimal CountyRate { get; set; }
    public decimal CityRate { get; set; }

    public bool IsActive { get; set; } = true;

    /// <summary>Effective date — rates change over time.</summary>
    public DateOnly EffectiveDate { get; set; }
    public DateOnly? ExpirationDate { get; set; }

    public List<TaxRate> Rates { get; set; } = [];
}

/// <summary>
/// Tax rate — a specific rate within a jurisdiction for a material category.
/// Allows different rates for materials, equipment, labor (labor is typically exempt).
/// </summary>
public class TaxRate : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }

    public Guid TaxJurisdictionId { get; set; }
    public TaxJurisdiction TaxJurisdiction { get; set; } = null!;

    public TaxCategory Category { get; set; }

    /// <summary>Tax rate as a percentage (e.g., 8.25 for 8.25%).</summary>
    public decimal Rate { get; set; }

    public bool IsActive { get; set; } = true;
    public DateOnly EffectiveDate { get; set; }
    public DateOnly? ExpirationDate { get; set; }
}

/// <summary>
/// Tax exemption — marks a project or vendor as tax-exempt.
/// Government projects, nonprofits, and certain material purchases can be exempt.
/// </summary>
public class TaxExemption : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }

    /// <summary>Exempt entity type: Project, Vendor, or Company.</summary>
    public TaxExemptionScope Scope { get; set; }

    /// <summary>The ID of the project or vendor that is exempt (null for company-wide).</summary>
    public Guid? EntityId { get; set; }

    public string? ExemptionCertificateNumber { get; set; }
    public string? Reason { get; set; }

    /// <summary>Which tax categories are exempt.</summary>
    public TaxCategory ExemptCategory { get; set; }

    public DateOnly EffectiveDate { get; set; }
    public DateOnly? ExpirationDate { get; set; }

    public bool IsActive { get; set; } = true;
}

/// <summary>
/// Currency exchange rate — daily rates for multi-currency support.
/// </summary>
public class CurrencyExchangeRate : BaseEntity
{
    /// <summary>Source currency (ISO 4217, e.g., "USD").</summary>
    public string FromCurrency { get; set; } = "USD";

    /// <summary>Target currency (ISO 4217, e.g., "CAD").</summary>
    public string ToCurrency { get; set; } = string.Empty;

    /// <summary>Exchange rate (1 FromCurrency = Rate ToCurrency).</summary>
    public decimal Rate { get; set; }

    /// <summary>Date this rate is effective.</summary>
    public DateOnly EffectiveDate { get; set; }

    /// <summary>Source of the rate (e.g., "Manual", "API").</summary>
    public string? Source { get; set; }
}

public enum TaxCategory
{
    Materials = 0,
    Equipment = 1,
    Labor = 2,
    Subcontract = 3,
    Other = 4,
    All = 5
}

public enum TaxExemptionScope
{
    Project = 0,
    Vendor = 1,
    Company = 2
}
