using Pitbull.Billing.Features.PayrollExports;
using Pitbull.Core.CQRS;

namespace Pitbull.Billing.Services;

public interface IPayrollExportService
{
    Task<Result<ListPayrollExportsResult>> ListAsync(ListPayrollExportsQuery query, CancellationToken cancellationToken = default);
    Task<Result<PayrollExportDto>> GenerateAsync(GeneratePayrollExportCommand command, CancellationToken cancellationToken = default);
    Task<Result<PayrollExportDownloadDto>> DownloadAsync(Guid exportId, CancellationToken cancellationToken = default);
}
