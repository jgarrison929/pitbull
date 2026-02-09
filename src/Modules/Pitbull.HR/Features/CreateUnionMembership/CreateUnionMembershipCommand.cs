using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.HR.Features.CreateUnionMembership;

public record CreateUnionMembershipCommand(
    Guid EmployeeId, string UnionLocal, string MembershipNumber, string Classification,
    int? ApprenticeLevel, DateOnly? JoinDate, bool DuesPaid, DateOnly? DuesPaidThrough,
    string? DispatchNumber, DateOnly? DispatchDate, int? DispatchListPosition,
    decimal? FringeRate, decimal? HealthWelfareRate, decimal? PensionRate, decimal? TrainingRate,
    DateOnly EffectiveDate, string? Notes
) : IRequest<Result<UnionMembershipDto>>;
