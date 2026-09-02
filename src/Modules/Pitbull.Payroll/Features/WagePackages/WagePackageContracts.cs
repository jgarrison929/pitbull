using Pitbull.Core.CQRS;
using Pitbull.Payroll.Domain;

namespace Pitbull.Payroll.Features.WagePackages;

public record WagePackageRateDto(
    Guid Id,
    Guid PayComponentId,
    string PayComponentCode,
    decimal HourlyRate,
    decimal Amount,
    WageRateUnit Unit,
    FringeMethod FringeMethod);

public record WagePackageDto(
    Guid Id,
    Guid UnionAgreementId,
    Guid WorkClassificationId,
    string ScaleCode,
    string? ZoneCode,
    string? ShiftCode,
    DateOnly EffectiveDate,
    DateOnly? ExpirationDate,
    IReadOnlyList<WagePackageRateDto> Rates,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record WagePackageRateInput(
    Guid PayComponentId,
    decimal HourlyRate = 0,
    decimal Amount = 0,
    WageRateUnit Unit = WageRateUnit.PerHour,
    FringeMethod FringeMethod = FringeMethod.Cash);

public record CreateWagePackageCommand(
    Guid UnionAgreementId,
    Guid WorkClassificationId,
    DateOnly EffectiveDate,
    string ScaleCode = "Journeyman",
    string? ZoneCode = null,
    string? ShiftCode = null,
    DateOnly? ExpirationDate = null,
    IReadOnlyList<WagePackageRateInput>? Rates = null) : ICommand<WagePackageDto>;

public record UpdateWagePackageCommand(
    Guid Id,
    string? ScaleCode = null,
    string? ZoneCode = null,
    string? ShiftCode = null,
    DateOnly? EffectiveDate = null,
    DateOnly? ExpirationDate = null,
    IReadOnlyList<WagePackageRateInput>? Rates = null) : ICommand<WagePackageDto>;

public record ListWagePackagesQuery(
    Guid? UnionAgreementId = null,
    Guid? WorkClassificationId = null,
    int Page = 1,
    int PageSize = 25) : IQuery<ListWagePackagesResult>;

public record ListWagePackagesResult(
    IReadOnlyList<WagePackageDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages);
