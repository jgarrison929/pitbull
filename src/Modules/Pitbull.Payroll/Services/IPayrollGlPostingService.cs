using Pitbull.Core.CQRS;
using Pitbull.Payroll.Features.PayrollRuns;

namespace Pitbull.Payroll.Services;

public interface IPayrollGlPostingService
{
    Task<Result<PayrollGlPostResult>> PostToGlAsync(
        Guid payrollRunId,
        Guid? postedByUserId,
        CancellationToken cancellationToken = default);
}
