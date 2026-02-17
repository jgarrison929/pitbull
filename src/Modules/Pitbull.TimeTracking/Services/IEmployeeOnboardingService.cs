using Pitbull.Core.CQRS;
using Pitbull.TimeTracking.Features;

namespace Pitbull.TimeTracking.Services;

/// <summary>
/// Service for employee onboarding operations including wizard step management,
/// emergency contacts, tax compliance, certifications, union affiliations,
/// and onboarding completion workflow.
/// </summary>
public interface IEmployeeOnboardingService
{
    // === Onboarding Status ===

    Task<Result<EmployeeOnboardingStatusDto>> GetOnboardingStatusAsync(
        Guid employeeId, CancellationToken cancellationToken = default);

    Task<Result<EmployeeOnboardingStatusDto>> CompleteOnboardingAsync(
        Guid employeeId, CompleteOnboardingRequest request, CancellationToken cancellationToken = default);

    // === Emergency Contacts ===

    Task<Result<IReadOnlyList<EmergencyContactDto>>> GetEmergencyContactsAsync(
        Guid employeeId, CancellationToken cancellationToken = default);

    Task<Result<EmergencyContactDto>> SaveEmergencyContactAsync(
        Guid employeeId, SaveEmergencyContactRequest request, CancellationToken cancellationToken = default);

    Task<Result> DeleteEmergencyContactAsync(
        Guid employeeId, Guid contactId, CancellationToken cancellationToken = default);

    // === Tax Compliance ===

    Task<Result<TaxComplianceDto>> GetTaxComplianceAsync(
        Guid employeeId, CancellationToken cancellationToken = default);

    Task<Result<TaxComplianceDto>> SaveTaxComplianceAsync(
        Guid employeeId, SaveTaxComplianceRequest request, CancellationToken cancellationToken = default);

    // === Certifications ===

    Task<Result<IReadOnlyList<CertificationDto>>> GetCertificationsAsync(
        Guid employeeId, CancellationToken cancellationToken = default);

    Task<Result<CertificationDto>> SaveCertificationAsync(
        Guid employeeId, SaveCertificationRequest request, CancellationToken cancellationToken = default);

    Task<Result> DeleteCertificationAsync(
        Guid employeeId, Guid certificationId, CancellationToken cancellationToken = default);

    // === Union Affiliations ===

    Task<Result<IReadOnlyList<UnionAffiliationDto>>> GetUnionAffiliationsAsync(
        Guid employeeId, CancellationToken cancellationToken = default);

    Task<Result<UnionAffiliationDto>> SaveUnionAffiliationAsync(
        Guid employeeId, SaveUnionAffiliationRequest request, CancellationToken cancellationToken = default);

    Task<Result> DeleteUnionAffiliationAsync(
        Guid employeeId, Guid affiliationId, CancellationToken cancellationToken = default);
}
