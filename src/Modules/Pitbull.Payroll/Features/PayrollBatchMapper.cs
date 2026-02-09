using Pitbull.Payroll.Domain;

namespace Pitbull.Payroll.Features;

public static class PayrollBatchMapper
{
    public static PayrollBatchDto ToDto(PayrollBatch b) => new(
        b.Id, b.PayPeriodId, b.BatchNumber, b.Status.ToString(),
        b.TotalRegularHours, b.TotalOvertimeHours, b.TotalDoubleTimeHours,
        b.TotalGrossPay, b.TotalDeductions, b.TotalNetPay,
        b.TotalEmployerTaxes, b.TotalUnionFringes, b.TotalEmployerCost,
        b.EmployeeCount, b.CreatedBy, b.CalculatedBy, b.CalculatedAt,
        b.ApprovedBy, b.ApprovedAt, b.PostedBy, b.PostedAt,
        b.Notes, b.CreatedAt, b.UpdatedAt
    );

    public static PayrollBatchListDto ToListDto(PayrollBatch b) => new(
        b.Id, b.PayPeriodId, b.BatchNumber, b.Status.ToString(),
        b.EmployeeCount, b.TotalGrossPay, b.TotalNetPay, b.TotalEmployerCost
    );
}
