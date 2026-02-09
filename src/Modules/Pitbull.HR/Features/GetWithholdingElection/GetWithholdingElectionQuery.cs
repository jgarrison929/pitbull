using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.HR.Features.GetWithholdingElection;

public record GetWithholdingElectionQuery(Guid Id) : IRequest<Result<WithholdingElectionDto>>;
