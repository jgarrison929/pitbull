using MediatR;
using Pitbull.Core.CQRS;
using Pitbull.Payroll.Domain;

namespace Pitbull.Payroll.Features.ListPayPeriods;

public record ListPayPeriodsQuery(
    PayPeriodStatus? Status = null, int? Year = null
) : IRequest<Result<PagedResult<PayPeriodListDto>>>
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 10;
}
