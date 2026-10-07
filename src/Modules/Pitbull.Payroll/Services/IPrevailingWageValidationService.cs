using Pitbull.Payroll.Features.PrevailingWageValidation;
using Pitbull.Core.CQRS;

namespace Pitbull.Payroll.Services;

public interface IPrevailingWageValidationService
{
    Task<Result<PrevailingWageValidationResult>> ValidatePayrollRunAsync(ValidatePayrollRunPrevailingWageQuery query, CancellationToken cancellationToken = default);
}
