namespace Pitbull.HR.Features;

/// <summary>
/// DTO for employee certification data.
/// </summary>
public record CertificationDto(
    Guid Id,
    Guid EmployeeId,
    string CertificationTypeCode,
    string CertificationName,
    string? CertificateNumber,
    string? IssuingAuthority,
    DateOnly IssueDate,
    DateOnly? ExpirationDate,
    string Status,
    DateTime? VerifiedAt,
    string? VerifiedBy,
    bool IsExpired,
    int? DaysUntilExpiration,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

/// <summary>
/// Lightweight DTO for certification lists.
/// </summary>
public record CertificationListDto(
    Guid Id,
    Guid EmployeeId,
    string EmployeeName,
    string CertificationTypeCode,
    string CertificationName,
    DateOnly? ExpirationDate,
    string Status,
    bool IsExpired,
    int? DaysUntilExpiration
);
