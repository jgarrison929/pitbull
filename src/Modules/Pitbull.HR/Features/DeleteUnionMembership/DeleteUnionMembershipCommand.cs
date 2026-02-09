using MediatR;

namespace Pitbull.HR.Features.DeleteUnionMembership;

public record DeleteUnionMembershipCommand(Guid Id) : IRequest<bool>;
