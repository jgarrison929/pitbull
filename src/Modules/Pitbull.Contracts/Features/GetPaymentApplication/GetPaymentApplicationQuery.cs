using MediatR;
using Pitbull.Contracts.Features.CreatePaymentApplication;
using Pitbull.Core.CQRS;

namespace Pitbull.Contracts.Features.GetPaymentApplication;

public record GetPaymentApplicationQuery(Guid Id) : IRequest<Result<PaymentApplicationDto>>;
