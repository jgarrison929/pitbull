using MediatR;
using Pitbull.Core.CQRS;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.CreateEmploymentEpisode;

public record CreateEmploymentEpisodeCommand(
    Guid EmployeeId,
    DateOnly HireDate,
    string? UnionDispatchReference,
    string? JobClassificationAtHire,
    decimal? HourlyRateAtHire,
    string? PositionAtHire
) : IRequest<Result<EmploymentEpisodeDto>>;
