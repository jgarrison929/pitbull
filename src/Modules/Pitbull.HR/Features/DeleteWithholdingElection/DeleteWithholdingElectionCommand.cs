using MediatR;

namespace Pitbull.HR.Features.DeleteWithholdingElection;

public record DeleteWithholdingElectionCommand(Guid Id) : IRequest<bool>;
