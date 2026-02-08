using MediatR;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreatePaymentApplication;
using Pitbull.Core.CQRS;

namespace Pitbull.Contracts.Features.ListPaymentApplications;

public record ListPaymentApplicationsQuery(
    Guid? SubcontractId,
    PaymentApplicationStatus? Status,
    int Page = 1,
    int PageSize = 20
) : IRequest<Result<PagedResult<PaymentApplicationDto>>>;
