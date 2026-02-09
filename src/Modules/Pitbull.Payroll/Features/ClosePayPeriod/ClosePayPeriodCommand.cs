using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.Payroll.Features.ClosePayPeriod;

public record ClosePayPeriodCommand(Guid Id, string ClosedBy) : IRequest<Result<PayPeriodDto>>;
