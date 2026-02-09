using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.HR.Features.GetPayRate;

public record GetPayRateQuery(Guid Id) : IRequest<Result<PayRateDto>>;
