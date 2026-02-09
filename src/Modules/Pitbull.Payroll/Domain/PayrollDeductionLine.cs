using Pitbull.Core.Domain;

namespace Pitbull.Payroll.Domain;

/// <summary>
/// Individual deduction applied to a payroll entry.
/// Links to HR.Deduction for the deduction definition.
/// </summary>
public class PayrollDeductionLine : BaseEntity
{
    public Guid PayrollEntryId { get; set; }
    public Guid DeductionId { get; set; }  // Links to HR.Deduction
    
    public string DeductionCode { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool IsPreTax { get; set; }
    
    public decimal Amount { get; set; }
    public decimal YtdBefore { get; set; }
    public decimal YtdAfter { get; set; }
    
    /// <summary>
    /// True if this hit the annual max and was capped.
    /// </summary>
    public bool HitAnnualMax { get; set; }
    
    /// <summary>
    /// Employer match amount (for 401k, etc.)
    /// </summary>
    public decimal EmployerMatch { get; set; }
    
    public PayrollEntry PayrollEntry { get; set; } = null!;
}
