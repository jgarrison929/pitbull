using Pitbull.Billing.Features.Wip;
using Pitbull.Core.CQRS;

namespace Pitbull.Billing.Services;

public interface IWipReportService
{
    Task<Result<ListWipReportsResult>> ListWipReportsAsync(ListWipReportsQuery query, CancellationToken cancellationToken = default);
    Task<Result<WipReportDto>> GetWipReportAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<WipReportDto>> CreateWipReportAsync(CreateWipReportCommand command, string generatedById, CancellationToken cancellationToken = default);
    Task<Result<WipReportDto>> UpdateWipReportAsync(UpdateWipReportCommand command, CancellationToken cancellationToken = default);
    Task<Result> DeleteWipReportAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<WipReportDto>> GenerateWipReportAsync(GenerateWipReportCommand command, string generatedById, CancellationToken cancellationToken = default);
    Task<Result<WipSuretyExportDto>> GetSuretyExportAsync(Guid id, CancellationToken cancellationToken = default);
}
