using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Features.WageDeterminations;

public record WageDeterminationDto(
    Guid Id,
    Guid ProjectId,
    WageJurisdictionType JurisdictionType,
    string DeterminationNumber,
    string? SourceAgency,
    DateOnly EffectiveDate,
    DateOnly? ExpirationDate,
    WageDeterminationStatus Status,
    string StatusName,
    IReadOnlyList<WageDeterminationRateDto> Rates,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record WageDeterminationRateDto(
    Guid Id,
    Guid WorkClassificationId,
    string ClassificationCode,
    string ClassificationName,
    decimal BaseRate,
    decimal FringeRate,
    decimal TotalRate
);

public record ApplicableWageRateDto(
    Guid WageDeterminationId,
    Guid WageDeterminationRateId,
    Guid WorkClassificationId,
    string ClassificationCode,
    decimal BaseRate,
    decimal FringeRate,
    decimal TotalRate,
    DateOnly EffectiveDate,
    DateOnly? ExpirationDate
);

public record CreateWageDeterminationRateInput(
    Guid WorkClassificationId,
    decimal BaseRate,
    decimal FringeRate,
    decimal TotalRate
);

public record CreateWageDeterminationCommand(
    Guid ProjectId,
    WageJurisdictionType JurisdictionType,
    string DeterminationNumber,
    string? SourceAgency,
    DateOnly EffectiveDate,
    DateOnly? ExpirationDate,
    WageDeterminationStatus Status,
    IReadOnlyList<CreateWageDeterminationRateInput> Rates
) : ICommand<WageDeterminationDto>;

public record UpdateWageDeterminationCommand(
    Guid WageDeterminationId,
    string? DeterminationNumber = null,
    string? SourceAgency = null,
    DateOnly? EffectiveDate = null,
    DateOnly? ExpirationDate = null,
    WageDeterminationStatus? Status = null,
    IReadOnlyList<CreateWageDeterminationRateInput>? Rates = null
) : ICommand<WageDeterminationDto>;

public record ListWageDeterminationsQuery(
    Guid? ProjectId = null,
    WageDeterminationStatus? Status = null,
    int Page = 1,
    int PageSize = 25
) : IQuery<ListWageDeterminationsResult>;

public record ListWageDeterminationsResult(
    IReadOnlyList<WageDeterminationDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);

public record ApplicableWageRateLookup(
    Guid ProjectId,
    Guid WorkClassificationId,
    DateOnly WorkDate
);
