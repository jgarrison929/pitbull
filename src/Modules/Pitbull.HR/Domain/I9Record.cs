using Pitbull.Core.Domain;

namespace Pitbull.HR.Domain;

/// <summary>
/// I-9 Employment Eligibility Verification record.
/// Required for all US employees within 3 days of hire.
/// </summary>
public class I9Record : BaseEntity
{
    public Guid EmployeeId { get; set; }
    
    // Section 1 - Employee Information
    public DateOnly Section1CompletedDate { get; set; }
    public string CitizenshipStatus { get; set; } = string.Empty; // Citizen, NationalUS, LPR, Alien
    public string? AlienNumber { get; set; }
    public string? I94Number { get; set; }
    public string? ForeignPassportNumber { get; set; }
    public string? ForeignPassportCountry { get; set; }
    public DateOnly? WorkAuthorizationExpires { get; set; }
    
    // Section 2 - Employer Review
    public DateOnly? Section2CompletedDate { get; set; }
    public string? Section2CompletedBy { get; set; }
    
    /// <summary>
    /// List A document (proves both identity and work authorization).
    /// </summary>
    public string? ListADocumentType { get; set; }
    public string? ListADocumentNumber { get; set; }
    public DateOnly? ListAExpirationDate { get; set; }
    
    /// <summary>
    /// List B document (proves identity only).
    /// </summary>
    public string? ListBDocumentType { get; set; }
    public string? ListBDocumentNumber { get; set; }
    public DateOnly? ListBExpirationDate { get; set; }
    
    /// <summary>
    /// List C document (proves work authorization only).
    /// </summary>
    public string? ListCDocumentType { get; set; }
    public string? ListCDocumentNumber { get; set; }
    public DateOnly? ListCExpirationDate { get; set; }
    
    /// <summary>
    /// First day of employment.
    /// </summary>
    public DateOnly EmploymentStartDate { get; set; }
    
    // Section 3 - Reverification (if applicable)
    public DateOnly? Section3Date { get; set; }
    public string? Section3NewDocumentType { get; set; }
    public string? Section3NewDocumentNumber { get; set; }
    public DateOnly? Section3NewDocumentExpiration { get; set; }
    public DateOnly? Section3RehireDate { get; set; }
    
    /// <summary>
    /// Current I-9 status.
    /// </summary>
    public I9Status Status { get; set; } = I9Status.NotStarted;
    
    /// <summary>
    /// E-Verify case ID if submitted.
    /// </summary>
    public string? EVerifyCaseNumber { get; set; }
    
    /// <summary>
    /// Notes about the verification.
    /// </summary>
    public string? Notes { get; set; }
    
    /// <summary>
    /// Date to purge this record (3 years after hire or 1 year after termination).
    /// </summary>
    public DateOnly? RetentionEndDate { get; set; }
    
    public Employee Employee { get; set; } = null!;
}
