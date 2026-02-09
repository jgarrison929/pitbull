using MediatR;

namespace Pitbull.HR.Features.DeleteCertification;

public record DeleteCertificationCommand(Guid Id) : IRequest<bool>;
