using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.HR.Features.GetUnionMembership;

public record GetUnionMembershipQuery(Guid Id) : IRequest<Result<UnionMembershipDto>>;
