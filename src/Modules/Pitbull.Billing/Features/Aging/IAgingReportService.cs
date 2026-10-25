using Pitbull.Core.CQRS;

namespace Pitbull.Billing.Features.Aging;

public interface IAgingReportService
{
    Task<Result<VendorAgingResult>> GetVendorAgingAsync(DateOnly? asOfDate = null, CancellationToken ct = default);
    Task<Result<CustomerAgingResult>> GetCustomerAgingAsync(DateOnly? asOfDate = null, CancellationToken ct = default);
    Task<Result<AgingSummaryResult>> GetAgingSummaryAsync(DateOnly? asOfDate = null, CancellationToken ct = default);
}
