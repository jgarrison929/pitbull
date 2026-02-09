using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.Payroll.Features.GetPayPeriod;

public record GetPayPeriodQuery(Guid Id) : IRequest<Result<PayPeriodDto>>;
