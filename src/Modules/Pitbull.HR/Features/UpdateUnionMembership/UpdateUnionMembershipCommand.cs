using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.HR.Features.UpdateUnionMembership;

public record UpdateUnionMembershipCommand(
    Guid Id, string Classification, int? ApprenticeLevel, bool DuesPaid, DateOnly? DuesPaidThrough,
    string? DispatchNumber, DateOnly? DispatchDate, int? DispatchListPosition,
    decimal? FringeRate, decimal? HealthWelfareRate, decimal? PensionRate, decimal? TrainingRate,
    DateOnly? ExpirationDate, string? Notes
) : IRequest<Result<UnionMembershipDto>>;
