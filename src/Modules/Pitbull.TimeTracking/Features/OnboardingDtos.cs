using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features;

// === Onboarding Status ===

public sealed record EmployeeOnboardingStatusDto(
    Guid EmployeeId,
    string EmployeeNumber,
    string FullName,
    OnboardingStatus OnboardingStatus,
    DateTime? OnboardingCompletedAt,
    bool HasEmergencyContacts,
    bool HasTaxCompliance,
    int CertificationCount,
    int UnionAffiliationCount
);

// === Emergency Contact ===

public sealed record EmergencyContactDto(
    Guid Id,
    Guid EmployeeId,
    string Name,
    string Relationship,
    string Phone,
    string? Email,
    string? Address,
    bool IsPrimary
);

public sealed record SaveEmergencyContactRequest(
    string Name,
    string Relationship,
    string Phone,
    string? Email,
    string? Address,
    bool IsPrimary
);

// === Tax Compliance ===

public sealed record TaxComplianceDto(
    Guid Id,
    Guid EmployeeId,
    W4FilingStatus W4FilingStatus,
    decimal W4AdditionalWithholding,
    bool W4Exempt,
    I9Status I9Status,
    DateTime? I9Section1Date,
    DateTime? I9Section2Date,
    string? I9VerifiedBy,
    bool CertifiedPayrollRequired,
    bool DavisBaconApplicable,
    string? PayrollNotes
);

public sealed record SaveTaxComplianceRequest(
    W4FilingStatus W4FilingStatus,
    decimal W4AdditionalWithholding,
    bool W4Exempt,
    I9Status I9Status,
    DateTime? I9Section1Date,
    DateTime? I9Section2Date,
    string? I9VerifiedBy,
    bool CertifiedPayrollRequired,
    bool DavisBaconApplicable,
    string? PayrollNotes
);

// === Certifications ===

public sealed record CertificationDto(
    Guid Id,
    Guid EmployeeId,
    string CertificationType,
    string CertificationName,
    string? CertificationNumber,
    DateTime IssuedDate,
    DateTime? ExpiresDate,
    string? IssuingAuthority,
    CertificationVerificationStatus VerificationStatus
);

public sealed record SaveCertificationRequest(
    string CertificationType,
    string CertificationName,
    string? CertificationNumber,
    DateTime IssuedDate,
    DateTime? ExpiresDate,
    string? IssuingAuthority
);

// === Union Affiliation ===

public sealed record UnionAffiliationDto(
    Guid Id,
    Guid EmployeeId,
    string? UnionName,
    string? LocalNumber,
    string? MemberId,
    string? Craft,
    string? ApprenticeLevel,
    string? ClassificationCode,
    string? ClassificationName,
    string? Jurisdiction,
    DateOnly? EffectiveDate,
    DateOnly? EndDate,
    string? Notes
);

public sealed record SaveUnionAffiliationRequest(
    string? UnionName,
    string? LocalNumber,
    string? MemberId,
    string? Craft,
    string? ApprenticeLevel,
    string? ClassificationCode,
    string? ClassificationName,
    string? Jurisdiction,
    DateOnly? EffectiveDate,
    DateOnly? EndDate,
    string? Notes
);

// === Settings ===

public sealed record EmployeeOnboardingSettingsDto(
    bool Enabled,
    bool RequireApprovalWorkflow,
    bool RequireEmergencyContact,
    bool RequireI9,
    bool RequireW4,
    bool RequireCertifications,
    string RequiredCertificationTypes,
    string DefaultPrevailingWageClass,
    bool EnableUnionFields
);

public sealed record UpdateEmployeeOnboardingSettingsRequest(
    bool Enabled,
    bool RequireApprovalWorkflow,
    bool RequireEmergencyContact,
    bool RequireI9,
    bool RequireW4,
    bool RequireCertifications,
    string RequiredCertificationTypes,
    string DefaultPrevailingWageClass,
    bool EnableUnionFields
);

// === Complete Onboarding ===

public sealed record CompleteOnboardingRequest(
    string? Notes
);

// === Onboarding Step Save (wizard) ===

public sealed record SaveOnboardingStepResponse(
    Guid EmployeeId,
    string StepKey,
    bool IsValid,
    IReadOnlyList<ValidationMessageDto> Errors,
    IReadOnlyList<ValidationMessageDto> Warnings
);

public sealed record ValidationMessageDto(
    string Field,
    string Code,
    string Message
);
