using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.HR.Features.GetEVerifyCase;

public record GetEVerifyCaseQuery(Guid Id) : IRequest<Result<EVerifyCaseDto>>;
