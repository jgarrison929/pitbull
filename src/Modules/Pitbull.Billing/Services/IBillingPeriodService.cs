using Pitbull.Billing.Features.AiaBilling;
using Pitbull.Core.CQRS;

namespace Pitbull.Billing.Services;

public interface IBillingPeriodService
{
    Task<Result<ListBillingPeriodsResult>> ListAsync(ListBillingPeriodsQuery query, CancellationToken ct = default);
    Task<Result<BillingPeriodDto>> GetAsync(Guid id, CancellationToken ct = default);
    Task<Result<BillingPeriodDto>> CreateAsync(CreateBillingPeriodCommand command, CancellationToken ct = default);
    Task<Result<BillingPeriodDto>> UpdateAsync(UpdateBillingPeriodCommand command, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid id, CancellationToken ct = default);
}
