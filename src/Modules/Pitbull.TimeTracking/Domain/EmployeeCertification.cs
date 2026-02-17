using Pitbull.Core.Domain;

namespace Pitbull.TimeTracking.Domain;

/// <summary>
/// Safety and trade certifications for an employee.
/// Tracks OSHA 10/30, CDL, welding, confined space, rigging, etc.
/// Expiration tracking is critical for construction site access compliance.
/// </summary>
public class EmployeeCertification : BaseEntity
{
    public Guid EmployeeId { get; set; }

    public string CertificationType { get; set; } = string.Empty;
    public string CertificationName { get; set; } = string.Empty;
    public string? CertificationNumber { get; set; }
    public DateTime IssuedDate { get; set; }
    public DateTime? ExpiresDate { get; set; }
    public string? IssuingAuthority { get; set; }
    public CertificationVerificationStatus VerificationStatus { get; set; } = CertificationVerificationStatus.Pending;

    // Navigation
    public Employee? Employee { get; set; }
}
