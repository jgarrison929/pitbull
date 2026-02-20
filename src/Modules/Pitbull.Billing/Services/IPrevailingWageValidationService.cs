using Pitbull.Billing.Features.PrevailingWageValidation;
using Pitbull.Core.CQRS;

namespace Pitbull.Billing.Services;

public interface IPrevailingWageValidationService
{
    Task<Result<PrevailingWageValidationResult>> ValidatePayrollRunAsync(ValidatePayrollRunPrevailingWageQuery query, CancellationToken cancellationToken = default);
}
