using MediatR;

namespace Pitbull.HR.Features.DeleteEVerifyCase;

public record DeleteEVerifyCaseCommand(Guid Id) : IRequest<bool>;
