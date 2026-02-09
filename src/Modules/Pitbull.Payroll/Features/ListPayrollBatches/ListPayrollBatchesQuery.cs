using MediatR;
using Pitbull.Core.CQRS;
using Pitbull.Payroll.Domain;

namespace Pitbull.Payroll.Features.ListPayrollBatches;

public record ListPayrollBatchesQuery(
    Guid? PayPeriodId = null, PayrollBatchStatus? Status = null
) : IRequest<Result<PagedResult<PayrollBatchListDto>>>
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 10;
}
