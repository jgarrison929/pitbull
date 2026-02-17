using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;

namespace Pitbull.TimeTracking.Services;

/// <summary>
/// Implementation of employee onboarding operations.
/// </summary>
public class EmployeeOnboardingService(PitbullDbContext db) : IEmployeeOnboardingService
{
    // === Onboarding Status ===

    public async Task<Result<EmployeeOnboardingStatusDto>> GetOnboardingStatusAsync(
        Guid employeeId, CancellationToken cancellationToken = default)
    {
        var employee = await db.Set<Employee>()
            .AsNoTracking()
            .Where(e => e.Id == employeeId)
            .Select(e => new
            {
                e.Id,
                e.EmployeeNumber,
                e.FirstName,
                e.LastName,
                e.OnboardingStatus,
                e.OnboardingCompletedAt,
                HasEmergencyContacts = e.EmergencyContacts.Any(),
                HasTaxCompliance = e.TaxCompliance != null,
                CertificationCount = e.Certifications.Count,
                UnionAffiliationCount = e.UnionAffiliations.Count
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (employee is null)
            return Result.Failure<EmployeeOnboardingStatusDto>("Employee not found", "NOT_FOUND");

        return Result.Success(new EmployeeOnboardingStatusDto(
            EmployeeId: employee.Id,
            EmployeeNumber: employee.EmployeeNumber,
            FullName: $"{employee.FirstName} {employee.LastName}".Trim(),
            OnboardingStatus: employee.OnboardingStatus,
            OnboardingCompletedAt: employee.OnboardingCompletedAt,
            HasEmergencyContacts: employee.HasEmergencyContacts,
            HasTaxCompliance: employee.HasTaxCompliance,
            CertificationCount: employee.CertificationCount,
            UnionAffiliationCount: employee.UnionAffiliationCount
        ));
    }

    public async Task<Result<EmployeeOnboardingStatusDto>> CompleteOnboardingAsync(
        Guid employeeId, CompleteOnboardingRequest request, CancellationToken cancellationToken = default)
    {
        var employee = await db.Set<Employee>()
            .Include(e => e.EmergencyContacts)
            .Include(e => e.TaxCompliance)
            .Include(e => e.Certifications)
            .Include(e => e.UnionAffiliations)
            .FirstOrDefaultAsync(e => e.Id == employeeId, cancellationToken);

        if (employee is null)
            return Result.Failure<EmployeeOnboardingStatusDto>("Employee not found", "NOT_FOUND");

        if (employee.OnboardingStatus == OnboardingStatus.Complete)
            return Result.Failure<EmployeeOnboardingStatusDto>("Onboarding already completed", "ALREADY_COMPLETED");

        employee.OnboardingStatus = OnboardingStatus.Complete;
        employee.OnboardingCompletedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(new EmployeeOnboardingStatusDto(
            EmployeeId: employee.Id,
            EmployeeNumber: employee.EmployeeNumber,
            FullName: employee.FullName,
            OnboardingStatus: employee.OnboardingStatus,
            OnboardingCompletedAt: employee.OnboardingCompletedAt,
            HasEmergencyContacts: employee.EmergencyContacts.Count > 0,
            HasTaxCompliance: employee.TaxCompliance != null,
            CertificationCount: employee.Certifications.Count,
            UnionAffiliationCount: employee.UnionAffiliations.Count
        ));
    }

    // === Emergency Contacts ===

    public async Task<Result<IReadOnlyList<EmergencyContactDto>>> GetEmergencyContactsAsync(
        Guid employeeId, CancellationToken cancellationToken = default)
    {
        var exists = await db.Set<Employee>().AnyAsync(e => e.Id == employeeId, cancellationToken);
        if (!exists)
            return Result.Failure<IReadOnlyList<EmergencyContactDto>>("Employee not found", "NOT_FOUND");

        var contacts = await db.Set<EmployeeEmergencyContact>()
            .AsNoTracking()
            .Where(c => c.EmployeeId == employeeId)
            .OrderByDescending(c => c.IsPrimary)
            .ThenBy(c => c.Name)
            .Select(c => MapContactDto(c))
            .ToListAsync(cancellationToken);

        return Result.Success<IReadOnlyList<EmergencyContactDto>>(contacts);
    }

    public async Task<Result<EmergencyContactDto>> SaveEmergencyContactAsync(
        Guid employeeId, SaveEmergencyContactRequest request, CancellationToken cancellationToken = default)
    {
        var employee = await db.Set<Employee>().AnyAsync(e => e.Id == employeeId, cancellationToken);
        if (!employee)
            return Result.Failure<EmergencyContactDto>("Employee not found", "NOT_FOUND");

        // If this is marked primary, unmark other primaries
        if (request.IsPrimary)
        {
            var existingPrimaries = await db.Set<EmployeeEmergencyContact>()
                .Where(c => c.EmployeeId == employeeId && c.IsPrimary)
                .ToListAsync(cancellationToken);
            foreach (var p in existingPrimaries) p.IsPrimary = false;
        }

        var contact = new EmployeeEmergencyContact
        {
            EmployeeId = employeeId,
            Name = request.Name,
            Relationship = request.Relationship,
            Phone = request.Phone,
            Email = request.Email,
            Address = request.Address,
            IsPrimary = request.IsPrimary
        };

        db.Set<EmployeeEmergencyContact>().Add(contact);
        await UpdateOnboardingProgress(employeeId, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(MapContactDto(contact));
    }

    public async Task<Result> DeleteEmergencyContactAsync(
        Guid employeeId, Guid contactId, CancellationToken cancellationToken = default)
    {
        var contact = await db.Set<EmployeeEmergencyContact>()
            .FirstOrDefaultAsync(c => c.Id == contactId && c.EmployeeId == employeeId, cancellationToken);

        if (contact is null)
            return Result.Failure("Emergency contact not found", "NOT_FOUND");

        db.Set<EmployeeEmergencyContact>().Remove(contact);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }

    // === Tax Compliance ===

    public async Task<Result<TaxComplianceDto>> GetTaxComplianceAsync(
        Guid employeeId, CancellationToken cancellationToken = default)
    {
        var exists = await db.Set<Employee>().AnyAsync(e => e.Id == employeeId, cancellationToken);
        if (!exists)
            return Result.Failure<TaxComplianceDto>("Employee not found", "NOT_FOUND");

        var tax = await db.Set<EmployeeTaxCompliance>()
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.EmployeeId == employeeId, cancellationToken);

        if (tax is null)
            return Result.Failure<TaxComplianceDto>("No tax compliance record", "NOT_FOUND");

        return Result.Success(MapTaxDto(tax));
    }

    public async Task<Result<TaxComplianceDto>> SaveTaxComplianceAsync(
        Guid employeeId, SaveTaxComplianceRequest request, CancellationToken cancellationToken = default)
    {
        var employeeExists = await db.Set<Employee>().AnyAsync(e => e.Id == employeeId, cancellationToken);
        if (!employeeExists)
            return Result.Failure<TaxComplianceDto>("Employee not found", "NOT_FOUND");

        // Validate I-9 dates
        if (request.I9Section2Date.HasValue && request.I9Section1Date.HasValue
            && request.I9Section2Date < request.I9Section1Date)
            return Result.Failure<TaxComplianceDto>("I-9 Section 2 date must be after Section 1 date", "VALIDATION_ERROR");

        if (request.I9Status == I9Status.Verified && string.IsNullOrWhiteSpace(request.I9VerifiedBy))
            return Result.Failure<TaxComplianceDto>("I-9 verifier is required when status is Verified", "VALIDATION_ERROR");

        var tax = await db.Set<EmployeeTaxCompliance>()
            .FirstOrDefaultAsync(t => t.EmployeeId == employeeId, cancellationToken);

        if (tax is null)
        {
            tax = new EmployeeTaxCompliance { EmployeeId = employeeId };
            db.Set<EmployeeTaxCompliance>().Add(tax);
        }

        tax.W4FilingStatus = request.W4FilingStatus;
        tax.W4AdditionalWithholding = request.W4AdditionalWithholding;
        tax.W4Exempt = request.W4Exempt;
        tax.I9Status = request.I9Status;
        tax.I9Section1Date = request.I9Section1Date;
        tax.I9Section2Date = request.I9Section2Date;
        tax.I9VerifiedBy = request.I9VerifiedBy;
        tax.CertifiedPayrollRequired = request.CertifiedPayrollRequired;
        tax.DavisBaconApplicable = request.DavisBaconApplicable;
        tax.PayrollNotes = request.PayrollNotes;

        await UpdateOnboardingProgress(employeeId, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(MapTaxDto(tax));
    }

    // === Certifications ===

    public async Task<Result<IReadOnlyList<CertificationDto>>> GetCertificationsAsync(
        Guid employeeId, CancellationToken cancellationToken = default)
    {
        var exists = await db.Set<Employee>().AnyAsync(e => e.Id == employeeId, cancellationToken);
        if (!exists)
            return Result.Failure<IReadOnlyList<CertificationDto>>("Employee not found", "NOT_FOUND");

        var certs = await db.Set<EmployeeCertification>()
            .AsNoTracking()
            .Where(c => c.EmployeeId == employeeId)
            .OrderBy(c => c.CertificationType)
            .ThenBy(c => c.IssuedDate)
            .Select(c => MapCertDto(c))
            .ToListAsync(cancellationToken);

        return Result.Success<IReadOnlyList<CertificationDto>>(certs);
    }

    public async Task<Result<CertificationDto>> SaveCertificationAsync(
        Guid employeeId, SaveCertificationRequest request, CancellationToken cancellationToken = default)
    {
        var employeeExists = await db.Set<Employee>().AnyAsync(e => e.Id == employeeId, cancellationToken);
        if (!employeeExists)
            return Result.Failure<CertificationDto>("Employee not found", "NOT_FOUND");

        if (request.ExpiresDate.HasValue && request.ExpiresDate <= request.IssuedDate)
            return Result.Failure<CertificationDto>("Expiration date must be after issued date", "VALIDATION_ERROR");

        var cert = new EmployeeCertification
        {
            EmployeeId = employeeId,
            CertificationType = request.CertificationType,
            CertificationName = request.CertificationName,
            CertificationNumber = request.CertificationNumber,
            IssuedDate = request.IssuedDate,
            ExpiresDate = request.ExpiresDate,
            IssuingAuthority = request.IssuingAuthority,
            VerificationStatus = CertificationVerificationStatus.Pending
        };

        db.Set<EmployeeCertification>().Add(cert);
        await UpdateOnboardingProgress(employeeId, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(MapCertDto(cert));
    }

    public async Task<Result> DeleteCertificationAsync(
        Guid employeeId, Guid certificationId, CancellationToken cancellationToken = default)
    {
        var cert = await db.Set<EmployeeCertification>()
            .FirstOrDefaultAsync(c => c.Id == certificationId && c.EmployeeId == employeeId, cancellationToken);

        if (cert is null)
            return Result.Failure("Certification not found", "NOT_FOUND");

        db.Set<EmployeeCertification>().Remove(cert);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }

    // === Union Affiliations ===

    public async Task<Result<IReadOnlyList<UnionAffiliationDto>>> GetUnionAffiliationsAsync(
        Guid employeeId, CancellationToken cancellationToken = default)
    {
        var exists = await db.Set<Employee>().AnyAsync(e => e.Id == employeeId, cancellationToken);
        if (!exists)
            return Result.Failure<IReadOnlyList<UnionAffiliationDto>>("Employee not found", "NOT_FOUND");

        var affiliations = await db.Set<EmployeeUnionAffiliation>()
            .AsNoTracking()
            .Where(u => u.EmployeeId == employeeId)
            .OrderByDescending(u => u.EffectiveDate)
            .Select(u => MapUnionDto(u))
            .ToListAsync(cancellationToken);

        return Result.Success<IReadOnlyList<UnionAffiliationDto>>(affiliations);
    }

    public async Task<Result<UnionAffiliationDto>> SaveUnionAffiliationAsync(
        Guid employeeId, SaveUnionAffiliationRequest request, CancellationToken cancellationToken = default)
    {
        var employeeExists = await db.Set<Employee>().AnyAsync(e => e.Id == employeeId, cancellationToken);
        if (!employeeExists)
            return Result.Failure<UnionAffiliationDto>("Employee not found", "NOT_FOUND");

        if (request.EndDate.HasValue && request.EffectiveDate.HasValue && request.EndDate < request.EffectiveDate)
            return Result.Failure<UnionAffiliationDto>("End date must be after effective date", "VALIDATION_ERROR");

        var affiliation = new EmployeeUnionAffiliation
        {
            EmployeeId = employeeId,
            UnionName = request.UnionName,
            LocalNumber = request.LocalNumber,
            MemberId = request.MemberId,
            Craft = request.Craft,
            ApprenticeLevel = request.ApprenticeLevel,
            ClassificationCode = request.ClassificationCode,
            ClassificationName = request.ClassificationName,
            Jurisdiction = request.Jurisdiction,
            EffectiveDate = request.EffectiveDate,
            EndDate = request.EndDate,
            Notes = request.Notes
        };

        db.Set<EmployeeUnionAffiliation>().Add(affiliation);
        await UpdateOnboardingProgress(employeeId, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(MapUnionDto(affiliation));
    }

    public async Task<Result> DeleteUnionAffiliationAsync(
        Guid employeeId, Guid affiliationId, CancellationToken cancellationToken = default)
    {
        var affiliation = await db.Set<EmployeeUnionAffiliation>()
            .FirstOrDefaultAsync(u => u.Id == affiliationId && u.EmployeeId == employeeId, cancellationToken);

        if (affiliation is null)
            return Result.Failure("Union affiliation not found", "NOT_FOUND");

        db.Set<EmployeeUnionAffiliation>().Remove(affiliation);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }

    // === Helpers ===

    private async Task UpdateOnboardingProgress(Guid employeeId, CancellationToken cancellationToken)
    {
        var employee = await db.Set<Employee>().FindAsync([employeeId], cancellationToken);
        if (employee is not null && employee.OnboardingStatus == OnboardingStatus.NotStarted)
        {
            employee.OnboardingStatus = OnboardingStatus.InProgress;
        }
    }

    private static EmergencyContactDto MapContactDto(EmployeeEmergencyContact c) => new(
        Id: c.Id, EmployeeId: c.EmployeeId,
        Name: c.Name, Relationship: c.Relationship, Phone: c.Phone,
        Email: c.Email, Address: c.Address, IsPrimary: c.IsPrimary);

    private static TaxComplianceDto MapTaxDto(EmployeeTaxCompliance t) => new(
        Id: t.Id, EmployeeId: t.EmployeeId,
        W4FilingStatus: t.W4FilingStatus, W4AdditionalWithholding: t.W4AdditionalWithholding, W4Exempt: t.W4Exempt,
        I9Status: t.I9Status, I9Section1Date: t.I9Section1Date, I9Section2Date: t.I9Section2Date, I9VerifiedBy: t.I9VerifiedBy,
        CertifiedPayrollRequired: t.CertifiedPayrollRequired, DavisBaconApplicable: t.DavisBaconApplicable,
        PayrollNotes: t.PayrollNotes);

    private static CertificationDto MapCertDto(EmployeeCertification c) => new(
        Id: c.Id, EmployeeId: c.EmployeeId,
        CertificationType: c.CertificationType, CertificationName: c.CertificationName,
        CertificationNumber: c.CertificationNumber, IssuedDate: c.IssuedDate, ExpiresDate: c.ExpiresDate,
        IssuingAuthority: c.IssuingAuthority, VerificationStatus: c.VerificationStatus);

    private static UnionAffiliationDto MapUnionDto(EmployeeUnionAffiliation u) => new(
        Id: u.Id, EmployeeId: u.EmployeeId,
        UnionName: u.UnionName, LocalNumber: u.LocalNumber, MemberId: u.MemberId,
        Craft: u.Craft, ApprenticeLevel: u.ApprenticeLevel,
        ClassificationCode: u.ClassificationCode, ClassificationName: u.ClassificationName,
        Jurisdiction: u.Jurisdiction, EffectiveDate: u.EffectiveDate, EndDate: u.EndDate,
        Notes: u.Notes);
}
