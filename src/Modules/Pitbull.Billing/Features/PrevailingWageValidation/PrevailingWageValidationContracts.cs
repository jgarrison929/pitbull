using Pitbull.Core.CQRS;

namespace Pitbull.Billing.Features.PrevailingWageValidation;

public record PrevailingWageViolationDto(
    Guid EmployeeId,
    Guid PayrollRunLineId,
    Guid ProjectId,
    Guid CostCodeId,
    Guid WorkClassificationId,
    decimal EmployeeRate,
    decimal RequiredRate,
    decimal Variance,
    string Message
);

public record PrevailingWageValidationResult(
    bool IsCompliant,
    IReadOnlyList<PrevailingWageViolationDto> Violations
);

public record ValidatePayrollRunPrevailingWageQuery(Guid PayrollRunId) : IQuery<PrevailingWageValidationResult>;
