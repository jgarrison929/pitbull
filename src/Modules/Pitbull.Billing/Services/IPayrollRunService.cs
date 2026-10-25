using Pitbull.Billing.Features.PayrollRuns;
using Pitbull.Core.CQRS;

namespace Pitbull.Billing.Services;

public interface IPayrollRunService
{
    Task<Result<ListPayrollRunsResult>> GetPayrollRunsAsync(ListPayrollRunsQuery query, CancellationToken cancellationToken = default);
    Task<Result<PayrollRunDto>> GetPayrollRunAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<PayrollRunDto>> CreatePayrollRunAsync(CreatePayrollRunCommand command, CancellationToken cancellationToken = default);
    Task<Result<PayrollRunDto>> UpdatePayrollRunAsync(UpdatePayrollRunCommand command, CancellationToken cancellationToken = default);
    Task<Result<PayrollRunDto>> GeneratePayrollRunAsync(GeneratePayrollRunCommand command, CancellationToken cancellationToken = default);
    Task<Result<PayrollRunDto>> ApprovePayrollRunAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<PayrollRunDto>> ExportPayrollRunAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result> DeletePayrollRunAsync(Guid id, CancellationToken cancellationToken = default);
}
