using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.HR.Features.GetCertification;

public record GetCertificationQuery(Guid Id) : IRequest<Result<CertificationDto>>;
