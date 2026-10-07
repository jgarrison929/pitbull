using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;

namespace Pitbull.Payroll.Features.CertifiedPayroll;

public record CertifiedPayrollReportDto(
    Guid Id,
    Guid PayrollRunId,
    Guid ProjectId,
    DateOnly WeekEnding,
    string WHDFormNumber,
    CertifiedPayrollStatus Status,
    string StatusName,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    string? SignerName = null,
    string? SignerTitle = null,
    DateTime? SignedAt = null,
    string? SignedByUserId = null,
    string? ExceptionsRemarks = null,
    string? FringeBenefitStatement = null
);

public record CertifiedPayrollLineDto(
    Guid EmployeeId,
    decimal RegularHours,
    decimal OvertimeHours,
    decimal DoubletimeHours,
    decimal GrossPay,
    Guid? Id = null,
    Guid? WorkClassificationId = null,
    string? WorkClassificationCode = null,
    string? WorkClassificationName = null,
    Guid? ProjectId = null,
    decimal RegularRate = 0,
    decimal OvertimeRate = 0,
    decimal DoubletimeRate = 0,
    decimal CashFringe = 0,
    decimal BenefitFringe = 0,
    decimal Deductions = 0,
    decimal NetPay = 0
);

public record CertifiedPayrollGenerateResult(
    CertifiedPayrollReportDto Report,
    IReadOnlyList<CertifiedPayrollLineDto> Lines,
    decimal TotalGross
);

public record CertifiedPayrollReportDetailDto(
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

public record SaveCertifiedPayrollStatementCommand(
    Guid ReportId,
    string SignerName,
    string SignerTitle,
    string FringeBenefitStatement,
    string? ExceptionsRemarks = null,
    string? SignedByUserId = null
) : ICommand<CertifiedPayrollReportDto>;

public record SubmitCertifiedPayrollCommand(
    Guid ReportId,
    string? SignedByUserId = null
) : ICommand<CertifiedPayrollReportDto>;
