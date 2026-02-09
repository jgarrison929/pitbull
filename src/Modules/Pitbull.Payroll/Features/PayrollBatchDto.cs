namespace Pitbull.Payroll.Features;

public record PayrollBatchDto(
    Guid Id, Guid PayPeriodId, string BatchNumber, string Status,
    decimal TotalRegularHours, decimal TotalOvertimeHours, decimal TotalDoubleTimeHours,
    decimal TotalGrossPay, decimal TotalDeductions, decimal TotalNetPay,
    decimal TotalEmployerTaxes, decimal TotalUnionFringes, decimal TotalEmployerCost,
    int EmployeeCount, string? CreatedBy, string? CalculatedBy, DateTime? CalculatedAt,
    string? ApprovedBy, DateTime? ApprovedAt, string? PostedBy, DateTime? PostedAt,
    string? Notes, DateTime CreatedAt, DateTime? UpdatedAt
);

public record PayrollBatchListDto(
    Guid Id, Guid PayPeriodId, string BatchNumber, string Status,
    int EmployeeCount, decimal TotalGrossPay, decimal TotalNetPay, decimal TotalEmployerCost
);

public record PayrollBatchSummaryDto(
    decimal TotalRegularHours, decimal TotalOvertimeHours, decimal TotalDoubleTimeHours,
    decimal TotalGrossPay, decimal TotalDeductions, decimal TotalNetPay,
    decimal TotalEmployerTaxes, decimal TotalUnionFringes, decimal TotalEmployerCost,
    int EmployeeCount
);
