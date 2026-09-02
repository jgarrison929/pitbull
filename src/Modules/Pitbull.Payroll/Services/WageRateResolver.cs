using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Payroll.Domain;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Payroll.Services;

/// <summary>
/// Overlay pack <c>union</c> rate lookup (spec 3.3 steps 1-2 and 5).
/// Registered via <see cref="UnionOverlayPack"/> — not if-branches in the run service.
/// </summary>
public class WageRateResolver(PitbullDbContext db) : IWageRateResolver
{
    public const string UnionPackName = "union";

    public async Task<Result<WageRateResult>> ResolveAsync(WageRateRequest request, CancellationToken cancellationToken = default)
    {
        Employee? employee = await db.Set<Employee>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.EmployeeId && !x.IsDeleted, cancellationToken);

        if (employee is null)
            return Result.Failure<WageRateResult>("Employee not found", "EMPLOYEE_NOT_FOUND");

        List<EmployeeUnionAffiliation> affiliations = await db.Set<EmployeeUnionAffiliation>()
            .AsNoTracking()
            .Where(x => x.EmployeeId == request.EmployeeId && !x.IsDeleted)
            .ToListAsync(cancellationToken);

        EmployeeUnionAffiliation? unionAffiliation = affiliations
            .Where(a => a.UnionAgreementId.HasValue)
            .Where(a => CoversDate(a, request.WorkDate))
            .OrderByDescending(a => a.EffectiveDate)
            .FirstOrDefault();

        bool isUnionRow = unionAffiliation is not null;

        Guid? classificationId = request.WorkClassificationId
            ?? unionAffiliation?.WorkClassificationId;

        if (classificationId is null && isUnionRow)
        {
            return Result.Failure<WageRateResult>(
                "Work classification is required for union payroll rows",
                "MISSING_WORK_CLASSIFICATION");
        }

        if (isUnionRow)
        {
            Result<WageRateResult>? package = await TryResolveUnionPackageAsync(
                unionAffiliation!,
                classificationId!.Value,
                request,
                cancellationToken);

            if (package is not null)
                return package;

            return Result.Failure<WageRateResult>(
                "No date-effective wage package matched this union row; BaseHourlyRate cannot be used",
                "UNION_RATE_NOT_FOUND");
        }

        return Result.Success(new WageRateResult(
            RegularRate: employee.BaseHourlyRate,
            OvertimeMultiplier: 1.5m,
            DoubletimeMultiplier: 2.0m,
            RateSource: RateSource.FallbackBaseRate,
            WorkClassificationId: classificationId,
            WagePackageId: null,
            OverlayPack: "core"));
    }

    private async Task<Result<WageRateResult>?> TryResolveUnionPackageAsync(
        EmployeeUnionAffiliation affiliation,
        Guid classificationId,
        WageRateRequest request,
        CancellationToken cancellationToken)
    {
        Guid agreementId = affiliation.UnionAgreementId!.Value;
        DateOnly workDate = request.WorkDate;
        string scale = FirstNonEmpty(affiliation.ScaleCode, affiliation.ApprenticeLevel, "Journeyman");
        string? shift = string.IsNullOrWhiteSpace(request.ShiftCode) ? null : request.ShiftCode.Trim();
        string? zone = string.IsNullOrWhiteSpace(request.ZoneCode) ? null : request.ZoneCode.Trim();

        UnionAgreement? agreement = await db.Set<UnionAgreement>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x =>
                x.Id == agreementId
                && !x.IsDeleted
                && x.Status == UnionAgreementStatus.Active
                && x.EffectiveDate <= workDate
                && (x.ExpirationDate == null || x.ExpirationDate >= workDate),
                cancellationToken);

        if (agreement is null)
            return null;

        List<WagePackage> packages = await db.Set<WagePackage>()
            .AsNoTracking()
            .Include(x => x.Rates)
            .ThenInclude(x => x.PayComponent)
            .Where(x => !x.IsDeleted
                && x.UnionAgreementId == agreementId
                && x.WorkClassificationId == classificationId
                && x.EffectiveDate <= workDate
                && (x.ExpirationDate == null || x.ExpirationDate >= workDate))
            .ToListAsync(cancellationToken);

        WagePackage? matched = packages
            .Where(p => ScaleMatches(p.ScaleCode, scale))
            .Where(p => OptionalCodeMatches(p.ShiftCode, shift))
            .Where(p => OptionalCodeMatches(p.ZoneCode, zone))
            .OrderByDescending(p => p.EffectiveDate)
            .ThenByDescending(p => p.ShiftCode != null)
            .ThenByDescending(p => p.ZoneCode != null)
            .FirstOrDefault();

        if (matched is null)
            return null;

        WagePackageRate? stRate = matched.Rates
            .Where(r => !r.IsDeleted)
            .FirstOrDefault(r => r.PayComponent != null && r.PayComponent.Code == "ST");

        if (stRate is null)
            return null;

        decimal regular = stRate.Unit == WageRateUnit.PerHour && stRate.HourlyRate > 0
            ? stRate.HourlyRate
            : stRate.Amount;

        (decimal ot, decimal dt) = await LoadMultipliersAsync(agreementId, workDate, cancellationToken);

        return Result.Success(new WageRateResult(
            RegularRate: regular,
            OvertimeMultiplier: ot,
            DoubletimeMultiplier: dt,
            RateSource: RateSource.UnionPackage,
            WorkClassificationId: classificationId,
            WagePackageId: matched.Id,
            OverlayPack: UnionPackName));
    }

    private async Task<(decimal Ot, decimal Dt)> LoadMultipliersAsync(
        Guid agreementId,
        DateOnly workDate,
        CancellationToken cancellationToken)
    {
        PayStructure? structure = await db.Set<PayStructure>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted
                && x.Status == PayStructureStatus.Active
                && x.UnionAgreementId == agreementId
                && x.EffectiveDate <= workDate
                && (x.ExpirationDate == null || x.ExpirationDate >= workDate))
            .OrderByDescending(x => x.EffectiveDate)
            .FirstOrDefaultAsync(cancellationToken);

        if (structure is null)
            return (1.5m, 2.0m);

        return (structure.OvertimeMultiplier, structure.DoubletimeMultiplier);
    }

    private static bool CoversDate(EmployeeUnionAffiliation affiliation, DateOnly workDate)
    {
        if (affiliation.EffectiveDate.HasValue && affiliation.EffectiveDate.Value > workDate)
            return false;
        if (affiliation.EndDate.HasValue && affiliation.EndDate.Value < workDate)
            return false;
        return true;
    }

    private static bool ScaleMatches(string packageScale, string requested)
        => string.Equals(packageScale.Trim(), requested.Trim(), StringComparison.OrdinalIgnoreCase);

    private static bool OptionalCodeMatches(string? packageCode, string? requested)
    {
        if (string.IsNullOrWhiteSpace(packageCode))
            return true;
        if (string.IsNullOrWhiteSpace(requested))
            return true;
        return string.Equals(packageCode.Trim(), requested.Trim(), StringComparison.OrdinalIgnoreCase);
    }

    private static string FirstNonEmpty(params string?[] values)
    {
        foreach (string? value in values)
        {
            if (!string.IsNullOrWhiteSpace(value))
                return value.Trim();
        }
        return "Journeyman";
    }
}
