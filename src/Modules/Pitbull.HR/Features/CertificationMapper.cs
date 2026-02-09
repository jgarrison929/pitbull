using Pitbull.HR.Domain;

namespace Pitbull.HR.Features;

/// <summary>
/// Maps Certification domain entities to DTOs.
/// </summary>
public static class CertificationMapper
{
    public static CertificationDto ToDto(Certification cert)
    {
        return new CertificationDto(
            Id: cert.Id,
            EmployeeId: cert.EmployeeId,
            CertificationTypeCode: cert.CertificationTypeCode,
            CertificationName: cert.CertificationName,
            CertificateNumber: cert.CertificateNumber,
            IssuingAuthority: cert.IssuingAuthority,
            IssueDate: cert.IssueDate,
            ExpirationDate: cert.ExpirationDate,
            Status: cert.Status.ToString(),
            VerifiedAt: cert.VerifiedAt,
            VerifiedBy: cert.VerifiedBy,
            IsExpired: cert.IsExpired,
            DaysUntilExpiration: cert.DaysUntilExpiration,
            CreatedAt: cert.CreatedAt,
            UpdatedAt: cert.UpdatedAt
        );
    }

    public static CertificationListDto ToListDto(Certification cert, string employeeName)
    {
        return new CertificationListDto(
            Id: cert.Id,
            EmployeeId: cert.EmployeeId,
            EmployeeName: employeeName,
            CertificationTypeCode: cert.CertificationTypeCode,
            CertificationName: cert.CertificationName,
            ExpirationDate: cert.ExpirationDate,
            Status: cert.Status.ToString(),
            IsExpired: cert.IsExpired,
            DaysUntilExpiration: cert.DaysUntilExpiration
        );
    }
}
