using Pitbull.Core.Domain;

namespace Pitbull.HR.Domain;

/// <summary>
/// Employee payroll deduction (benefits, garnishments, union dues, etc.)
/// </summary>
public class Deduction : BaseEntity
{
    public Guid EmployeeId { get; set; }
    
    /// <summary>
    /// Deduction type (HEALTH, DENTAL, 401K, GARNISHMENT, UNION_DUES, etc.)
    /// </summary>
    public string DeductionCode { get; set; } = string.Empty;
    
    /// <summary>
    /// Human-readable description.
    /// </summary>
    public string Description { get; set; } = string.Empty;
    
    /// <summary>
    /// How the deduction is calculated.
    /// </summary>
    public DeductionMethod Method { get; set; } = DeductionMethod.FlatAmount;
    
    /// <summary>
    /// Amount (flat) or rate (percentage) depending on Method.
    /// </summary>
    public decimal Amount { get; set; }
    
    /// <summary>
    /// For percentage deductions, max amount per pay period.
    /// </summary>
    public decimal? MaxPerPeriod { get; set; }
    
    /// <summary>
    /// Annual maximum (e.g., 401k contribution limits).
    /// </summary>
    public decimal? AnnualMax { get; set; }
    
    /// <summary>
    /// YTD amount deducted (reset annually).
    /// </summary>
    public decimal YtdAmount { get; set; }
    
    /// <summary>
    /// Garnishment priority (1 = highest, processed first).
    /// </summary>
    public int Priority { get; set; } = 50;
    
    /// <summary>
    /// Pre-tax (reduces taxable income) vs post-tax.
    /// </summary>
    public bool IsPreTax { get; set; }
    
    /// <summary>
    /// Employer match amount/percentage.
    /// </summary>
    public decimal? EmployerMatch { get; set; }
    
    /// <summary>
    /// Max employer match per pay period.
    /// </summary>
    public decimal? EmployerMatchMax { get; set; }
    
    public DateOnly EffectiveDate { get; set; }
    public DateOnly? ExpirationDate { get; set; }
    
    /// <summary>
    /// Court case number for garnishments.
    /// </summary>
    public string? CaseNumber { get; set; }
    
    /// <summary>
    /// Payee for garnishments (e.g., child support agency).
    /// </summary>
    public string? GarnishmentPayee { get; set; }
    
    public string? Notes { get; set; }
    
    public Employee Employee { get; set; } = null!;
    
    public bool IsActive => !ExpirationDate.HasValue || ExpirationDate.Value >= DateOnly.FromDateTime(DateTime.UtcNow);
}

public enum DeductionMethod
{
    FlatAmount = 1,
    PercentOfGross = 2,
    PercentOfNet = 3,
    PerHour = 4
}
