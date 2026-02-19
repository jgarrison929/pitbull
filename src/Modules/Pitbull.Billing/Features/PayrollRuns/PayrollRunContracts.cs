using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Features.PayrollRuns;

public record PayrollRunDto(
    Guid Id,
    DateOnly RunDate,
    Guid PayPeriodId,
    PayrollRunStatus Status,
    string StatusName,
    decimal TotalGross,
    decimal TotalNet,
    int EmployeeCount,
    IReadOnlyList<PayrollRunLineDto> Lines,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record PayrollRunLineDto(
    Guid Id,
    Guid EmployeeId,
    decimal RegularHours,
    decimal OvertimeHours,
    decimal DoubletimeHours,
    decimal RegularPay,
    decimal OvertimePay,
    decimal DoubletimePay,
    decimal GrossPay
);

public record CreatePayrollRunCommand(
    DateOnly RunDate,
    Guid PayPeriodId
) : ICommand<PayrollRunDto>;

public record UpdatePayrollRunCommand(
    Guid PayrollRunId,
    DateOnly? RunDate = null,
    PayrollRunStatus? Status = null
) : ICommand<PayrollRunDto>;

public record GeneratePayrollRunCommand(
    DateOnly RunDate,
    Guid PayPeriodId
) : ICommand<PayrollRunDto>;

public record ListPayrollRunsQuery(
    PayrollRunStatus? Status = null,
    Guid? PayPeriodId = null,
    int Page = 1,
    int PageSize = 25
) : IQuery<ListPayrollRunsResult>;

public record ListPayrollRunsResult(
    IReadOnlyList<PayrollRunDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);
