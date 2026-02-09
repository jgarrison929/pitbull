using Pitbull.Core.Domain;

namespace Pitbull.HR.Domain;

/// <summary>
/// Tax withholding election (Federal W-4 or State equivalent).
/// Uses effective dating - never delete, just expire and create new.
/// </summary>
public class WithholdingElection : BaseEntity
{
    public Guid EmployeeId { get; set; }
    
    /// <summary>
    /// "FEDERAL" or 2-letter state code (CA, TX, NY, etc.)
    /// </summary>
    public string TaxJurisdiction { get; set; } = "FEDERAL";
    
    /// <summary>
    /// Filing status for this jurisdiction.
    /// </summary>
    public FilingStatus FilingStatus { get; set; } = FilingStatus.Single;
    
    /// <summary>
    /// Number of allowances/exemptions claimed.
    /// </summary>
    public int Allowances { get; set; }
    
    /// <summary>
    /// Additional flat withholding per pay period.
    /// </summary>
    public decimal AdditionalWithholding { get; set; }
    
    /// <summary>
    /// True if employee claims exempt from withholding.
    /// </summary>
    public bool IsExempt { get; set; }
    
    /// <summary>
    /// For 2020+ W-4: Multiple jobs or spouse works checkbox.
    /// </summary>
    public bool MultipleJobsOrSpouseWorks { get; set; }
    
    /// <summary>
    /// For 2020+ W-4: Dependent credits amount.
    /// </summary>
    public decimal? DependentCredits { get; set; }
    
    /// <summary>
    /// For 2020+ W-4: Other income not from jobs.
    /// </summary>
    public decimal? OtherIncome { get; set; }
    
    /// <summary>
    /// For 2020+ W-4: Deductions to claim.
    /// </summary>
    public decimal? Deductions { get; set; }
    
    /// <summary>
    /// Date this election becomes effective.
    /// </summary>
    public DateOnly EffectiveDate { get; set; }
    
    /// <summary>
    /// Date this election expires (null = current).
    /// </summary>
    public DateOnly? ExpirationDate { get; set; }
    
    /// <summary>
    /// Date employee signed the W-4.
    /// </summary>
    public DateOnly? SignedDate { get; set; }
    
    /// <summary>
    /// Notes about this election.
    /// </summary>
    public string? Notes { get; set; }
    
    // Navigation
    public Employee Employee { get; set; } = null!;
    
    public bool IsCurrent => !ExpirationDate.HasValue || ExpirationDate.Value >= DateOnly.FromDateTime(DateTime.UtcNow);
}

public enum FilingStatus
{
    Single = 1,
    MarriedFilingJointly = 2,
    MarriedFilingSeparately = 3,
    HeadOfHousehold = 4,
    QualifyingWidower = 5
}
