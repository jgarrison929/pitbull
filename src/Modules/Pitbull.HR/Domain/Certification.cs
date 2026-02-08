using Pitbull.Core.Domain;

namespace Pitbull.HR.Domain;

/// <summary>
/// Employee certification/license with expiration tracking.
/// Hard stops prevent time logging with expired required certifications.
/// </summary>
public class Certification : BaseEntity
{
    /// <summary>
    /// Parent employee.
    /// </summary>
    public Guid EmployeeId { get; set; }
    
    /// <summary>
    /// Certification type code (e.g., "OSHA10", "CDL", "FIRST_AID").
    /// </summary>
    public string CertificationTypeCode { get; set; } = string.Empty;
    
    /// <summary>
    /// Human-readable name of the certification.
    /// </summary>
    public string CertificationName { get; set; } = string.Empty;
    
    /// <summary>
    /// Certificate/license number.
    /// </summary>
    public string? CertificateNumber { get; set; }
    
    /// <summary>
    /// Issuing authority/organization.
    /// </summary>
    public string? IssuingAuthority { get; set; }
    
    /// <summary>
    /// Date certification was issued.
    /// </summary>
    public DateOnly IssueDate { get; set; }
    
    /// <summary>
    /// Expiration date (null for non-expiring certifications).
    /// </summary>
    public DateOnly? ExpirationDate { get; set; }
    
    /// <summary>
    /// Current verification status.
    /// </summary>
    public CertificationStatus Status { get; set; } = CertificationStatus.Pending;
    
    /// <summary>
    /// Date verification was performed.
    /// </summary>
    public DateTime? VerifiedAt { get; set; }
    
    /// <summary>
    /// Who verified the certification.
    /// </summary>
    public string? VerifiedBy { get; set; }
    
    /// <summary>
    /// Notes about verification.
    /// </summary>
    public string? VerificationNotes { get; set; }
    
    // ──────────────────────────────────────────────────────────────
    // Warning Tracking (for automated notifications)
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Date 90-day warning was sent.
    /// </summary>
    public DateTime? Warning90DaysSentAt { get; set; }
    
    /// <summary>
    /// Date 60-day warning was sent.
    /// </summary>
    public DateTime? Warning60DaysSentAt { get; set; }
    
    /// <summary>
    /// Date 30-day warning was sent.
    /// </summary>
    public DateTime? Warning30DaysSentAt { get; set; }
    
    /// <summary>
    /// Date expired notification was sent.
    /// </summary>
    public DateTime? ExpiredNotificationSentAt { get; set; }
    
    // ──────────────────────────────────────────────────────────────
    // Document Link
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Link to scanned certificate document.
    /// </summary>
    public Guid? DocumentId { get; set; }
    
    // Navigation
    public Employee Employee { get; set; } = null!;
    
    // ──────────────────────────────────────────────────────────────
    // Computed Properties
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Whether the certification is currently expired.
    /// </summary>
    public bool IsExpired => ExpirationDate.HasValue && ExpirationDate.Value < DateOnly.FromDateTime(DateTime.UtcNow);
    
    /// <summary>
    /// Days until expiration (negative if expired, null if no expiration).
    /// </summary>
    public int? DaysUntilExpiration => ExpirationDate.HasValue 
        ? ExpirationDate.Value.DayNumber - DateOnly.FromDateTime(DateTime.UtcNow).DayNumber 
        : null;
}

/// <summary>
/// Certification verification status.
/// </summary>
public enum CertificationStatus
{
    /// <summary>Awaiting verification.</summary>
    Pending = 0,
    
    /// <summary>Verified and valid.</summary>
    Verified = 1,
    
    /// <summary>Verification failed.</summary>
    Invalid = 2,
    
    /// <summary>Expired (automatically set by system).</summary>
    Expired = 3,
    
    /// <summary>Revoked by issuing authority.</summary>
    Revoked = 4
}
