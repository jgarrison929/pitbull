using Pitbull.Core.Domain;

namespace Pitbull.HR.Domain;

/// <summary>
/// Employee pay rate with effective dating and multi-dimensional scoping.
/// Supports construction-specific patterns: prevailing wage, shift differentials,
/// project-specific rates, and union scale.
/// </summary>
public class PayRate : BaseEntity
{
    /// <summary>
    /// Parent employee.
    /// </summary>
    public Guid EmployeeId { get; set; }
    
    /// <summary>
    /// Human-readable description of this rate.
    /// </summary>
    public string? Description { get; set; }
    
    // ──────────────────────────────────────────────────────────────
    // Rate Definition
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Type of rate calculation.
    /// </summary>
    public RateType RateType { get; set; } = RateType.Hourly;
    
    /// <summary>
    /// Base rate amount.
    /// </summary>
    public decimal Amount { get; set; }
    
    /// <summary>
    /// Currency code (default USD).
    /// </summary>
    public string Currency { get; set; } = "USD";
    
    // ──────────────────────────────────────────────────────────────
    // Effective Dating
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// When this rate becomes active.
    /// </summary>
    public DateOnly EffectiveDate { get; set; }
    
    /// <summary>
    /// When this rate expires (null = indefinite).
    /// </summary>
    public DateOnly? ExpirationDate { get; set; }
    
    // ──────────────────────────────────────────────────────────────
    // Scoping (all nullable = applies to all)
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Specific project this rate applies to (null = all projects).
    /// </summary>
    public Guid? ProjectId { get; set; }
    
    /// <summary>
    /// Shift code (e.g., "DAY", "SWING", "GRAVE").
    /// </summary>
    public string? ShiftCode { get; set; }
    
    /// <summary>
    /// Work state this rate applies to (for state-specific rates).
    /// </summary>
    public string? WorkState { get; set; }
    
    // ──────────────────────────────────────────────────────────────
    // Rate Selection Priority
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Priority for rate selection (higher = checked first).
    /// Default priority tiers:
    ///   100 = Project + Classification + WageDetermination
    ///    90 = Project + Classification
    ///    80 = WageDetermination only
    ///    70 = Classification only
    ///    50 = Shift differential
    ///    10 = Default rate
    /// </summary>
    public int Priority { get; set; } = 10;
    
    // ──────────────────────────────────────────────────────────────
    // Fringe Benefits (Union/Prevailing Wage)
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Whether this rate includes fringe calculations.
    /// </summary>
    public bool IncludesFringe { get; set; }
    
    /// <summary>
    /// Fringe benefit rate (hourly).
    /// </summary>
    public decimal? FringeRate { get; set; }
    
    /// <summary>
    /// Health & welfare contribution (hourly).
    /// </summary>
    public decimal? HealthWelfareRate { get; set; }
    
    /// <summary>
    /// Pension contribution (hourly).
    /// </summary>
    public decimal? PensionRate { get; set; }
    
    /// <summary>
    /// Training fund contribution (hourly).
    /// </summary>
    public decimal? TrainingRate { get; set; }
    
    /// <summary>
    /// Other fringe contributions (hourly).
    /// </summary>
    public decimal? OtherFringeRate { get; set; }
    
    /// <summary>
    /// Total hourly cost (base + all fringe).
    /// </summary>
    public decimal TotalHourlyCost => Amount + (FringeRate ?? 0) + 
        (HealthWelfareRate ?? 0) + (PensionRate ?? 0) + 
        (TrainingRate ?? 0) + (OtherFringeRate ?? 0);
    
    // ──────────────────────────────────────────────────────────────
    // Metadata
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Source of this rate (manual entry, union scale import, etc.)
    /// </summary>
    public RateSource Source { get; set; } = RateSource.Manual;
    
    /// <summary>
    /// Notes about this rate.
    /// </summary>
    public string? Notes { get; set; }
    
    // Navigation
    public Employee Employee { get; set; } = null!;
    
    // ──────────────────────────────────────────────────────────────
    // Computed Properties
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Whether this rate is currently active.
    /// </summary>
    public bool IsActive(DateOnly asOfDate) => 
        EffectiveDate <= asOfDate && 
        (!ExpirationDate.HasValue || ExpirationDate.Value >= asOfDate);
}

/// <summary>
/// Rate type for payroll calculation.
/// </summary>
public enum RateType
{
    /// <summary>Hourly pay rate.</summary>
    Hourly = 1,
    
    /// <summary>Daily rate (8 hours standard).</summary>
    Daily = 2,
    
    /// <summary>Per-piece rate.</summary>
    Piece = 3,
    
    /// <summary>Salary (divided by period).</summary>
    Salary = 4
}

/// <summary>
/// Source of the pay rate.
/// </summary>
public enum RateSource
{
    /// <summary>Manually entered.</summary>
    Manual = 0,
    
    /// <summary>Imported from union scale tables.</summary>
    UnionScale = 1,
    
    /// <summary>From wage determination (Davis-Bacon).</summary>
    WageDetermination = 2,
    
    /// <summary>Imported from external payroll system.</summary>
    PayrollImport = 3,
    
    /// <summary>Calculated/derived rate.</summary>
    Calculated = 4
}
