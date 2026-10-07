using Pitbull.Core.Domain;

namespace Pitbull.Payroll.Domain;

public enum PayrollTaxVendor
{
    Check = 1,
    Symmetry = 2,
    Vertex = 3,
    Adp = 4,
    Paychex = 5
}

/// <summary>
/// Imported vendor tax snapshot metadata. Pitbull does not author federal/state/local percentage rows.
/// For Check-class SoR, this records which vendor version ran (or would run) without storing local tables.
/// </summary>
public class TaxTableVersion : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }
    public PayrollTaxVendor Vendor { get; set; } = PayrollTaxVendor.Check;
    public string Jurisdiction { get; set; } = string.Empty;
    public DateOnly EffectiveDate { get; set; }
    public string ContentHash { get; set; } = string.Empty;
    public DateTime ImportedAt { get; set; }
    public string? Notes { get; set; }
}
