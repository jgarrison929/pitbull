using MediatR;
using Pitbull.Core.CQRS;
using Pitbull.Payroll.Domain;

namespace Pitbull.Payroll.Features.CreatePayPeriod;

public record CreatePayPeriodCommand(
    DateOnly StartDate, DateOnly EndDate, DateOnly PayDate, PayFrequency Frequency, string? Notes
) : IRequest<Result<PayPeriodDto>>;
