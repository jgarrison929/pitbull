using MediatR;
using Pitbull.Core.CQRS;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.CreatePayRate;

public record CreatePayRateCommand(
    Guid EmployeeId,
    string? Description,
    RateType RateType,
    decimal Amount,
    string? Currency,
    DateOnly EffectiveDate,
    DateOnly? ExpirationDate,
    Guid? ProjectId,
    string? ShiftCode,
    string? WorkState,
    int? Priority,
    bool IncludesFringe,
    decimal? FringeRate,
    decimal? HealthWelfareRate,
    decimal? PensionRate,
    decimal? TrainingRate,
    decimal? OtherFringeRate,
    RateSource? Source,
    string? Notes
) : IRequest<Result<PayRateDto>>;
