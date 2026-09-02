using Pitbull.Payroll.Features.PayrollExports;
using Pitbull.Core.CQRS;

namespace Pitbull.Payroll.Services;

public interface IPayrollExportService
{
    Task<Result<ListPayrollExportsResult>> ListAsync(ListPayrollExportsQuery query, CancellationToken cancellationToken = default);
    Task<Result<PayrollExportDto>> GenerateAsync(GeneratePayrollExportCommand command, CancellationToken cancellationToken = default);
    Task<Result<PayrollExportDownloadDto>> DownloadAsync(Guid exportId, CancellationToken cancellationToken = default);
}
