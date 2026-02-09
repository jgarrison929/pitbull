using Pitbull.Core.Domain;

namespace Pitbull.HR.Domain;

/// <summary>
/// E-Verify case tracking for employment authorization verification.
/// Federal contractors and certain states require E-Verify.
/// </summary>
public class EVerifyCase : BaseEntity
{
    public Guid EmployeeId { get; set; }
    public Guid? I9RecordId { get; set; }
    
    /// <summary>
    /// E-Verify case number from DHS.
    /// </summary>
    public string CaseNumber { get; set; } = string.Empty;
    
    /// <summary>
    /// Date case was submitted.
    /// </summary>
    public DateOnly SubmittedDate { get; set; }
    
    /// <summary>
    /// Current case status.
    /// </summary>
    public EVerifyStatus Status { get; set; } = EVerifyStatus.Pending;
    
    /// <summary>
    /// Date of last status update from E-Verify.
    /// </summary>
    public DateOnly? LastStatusDate { get; set; }
    
    /// <summary>
    /// Verification result.
    /// </summary>
    public EVerifyResult? Result { get; set; }
    
    /// <summary>
    /// Date case was closed (authorized or final non-confirmation).
    /// </summary>
    public DateOnly? ClosedDate { get; set; }
    
    /// <summary>
    /// If TNC issued, deadline for employee to contest.
    /// </summary>
    public DateOnly? TNCDeadline { get; set; }
    
    /// <summary>
    /// Did employee contest the TNC?
    /// </summary>
    public bool? TNCContested { get; set; }
    
    /// <summary>
    /// Photo match verification result (if applicable).
    /// </summary>
    public bool? PhotoMatched { get; set; }
    
    /// <summary>
    /// SSA verification result.
    /// </summary>
    public EVerifySSAResult? SSAResult { get; set; }
    
    /// <summary>
    /// DHS verification result.
    /// </summary>
    public EVerifyDHSResult? DHSResult { get; set; }
    
    /// <summary>
    /// Submitted by (HR user).
    /// </summary>
    public string SubmittedBy { get; set; } = string.Empty;
    
    public string? Notes { get; set; }
    
    public Employee Employee { get; set; } = null!;
    public I9Record? I9Record { get; set; }
}
