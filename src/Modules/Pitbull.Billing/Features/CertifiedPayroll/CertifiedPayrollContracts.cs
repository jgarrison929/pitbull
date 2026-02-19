using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Features.CertifiedPayroll;

public record CertifiedPayrollReportDto(
    Guid Id,
    Guid PayrollRunId,
    Guid ProjectId,
    DateOnly WeekEnding,
    string WHDFormNumber,
    CertifiedPayrollStatus Status,
    string StatusName,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record CertifiedPayrollLineDto(
    Guid EmployeeId,
    decimal RegularHours,
    decimal OvertimeHours,
    decimal DoubletimeHours,
    decimal GrossPay
);

public record CertifiedPayrollGenerateResult(
    CertifiedPayrollReportDto Report,
    IReadOnlyList<CertifiedPayrollLineDto> Lines,
    decimal TotalGross
);

public record GenerateCertifiedPayrollCommand(
    Guid PayrollRunId,
    Guid ProjectId,
    DateOnly WeekEnding
) : ICommand<CertifiedPayrollGenerateResult>;

public record ListCertifiedPayrollReportsQuery(
    Guid? PayrollRunId = null,
    Guid? ProjectId = null,
    CertifiedPayrollStatus? Status = null,
    int Page = 1,
    int PageSize = 25
) : IQuery<ListCertifiedPayrollReportsResult>;

public record ListCertifiedPayrollReportsResult(
    IReadOnlyList<CertifiedPayrollReportDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);
