using Pitbull.Contracts.Features.CreatePaymentApplication;
using Pitbull.Core.CQRS;

namespace Pitbull.Contracts.Features.GetPaymentApplication;

public record GetPaymentApplicationQuery(Guid Id) : IQuery<PaymentApplicationDto>;
