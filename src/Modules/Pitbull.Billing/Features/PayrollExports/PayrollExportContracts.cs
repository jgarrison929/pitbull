using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Features.PayrollExports;

public record PayrollExportDto(
    Guid Id,
    Guid PayrollRunId,
    PayrollExportFormat Format,
    string FormatName,
    DateTime ExportedAt,
    string FilePath,
    string FileName,
    int LineCount,
    decimal TotalGross,
    decimal TotalNet,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record PayrollExportLineDto(
    Guid Id,
    Guid EmployeeId,
    string EmployeeName,
    string MaskedSsn,
    decimal StraightTimeHours,
    decimal OvertimeHours,
    decimal DoubletimeHours,
    decimal HourlyRate,
    decimal GrossPay,
    decimal Deductions,
    decimal NetPay,
    Guid ProjectId,
    Guid CostCodeId,
    Guid? WorkClassificationId
);

public record GeneratePayrollExportCommand(
    Guid PayrollRunId,
    PayrollExportFormat Format,
    DateOnly? StartDate,
    DateOnly? EndDate
) : ICommand<PayrollExportDto>;

public record ListPayrollExportsQuery(
    Guid? PayrollRunId = null,
    PayrollExportFormat? Format = null,
    DateOnly? StartDate = null,
    DateOnly? EndDate = null,
    int Page = 1,
    int PageSize = 25
) : IQuery<ListPayrollExportsResult>;

public record ListPayrollExportsResult(
    IReadOnlyList<PayrollExportDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);

public record PayrollExportDownloadDto(
    string FileName,
    string ContentType,
    string Content
);
