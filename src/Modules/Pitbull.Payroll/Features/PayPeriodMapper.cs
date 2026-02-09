using Pitbull.Payroll.Domain;

namespace Pitbull.Payroll.Features;

public static class PayPeriodMapper
{
    public static PayPeriodDto ToDto(PayPeriod p) => new(
        p.Id, p.StartDate, p.EndDate, p.PayDate, p.Frequency.ToString(), p.Status.ToString(),
        p.ProcessedBy, p.ProcessedAt, p.ApprovedBy, p.ApprovedAt, p.Notes,
        p.Batches?.Count ?? 0, p.CreatedAt, p.UpdatedAt
    );

    public static PayPeriodListDto ToListDto(PayPeriod p) => new(
        p.Id, p.StartDate, p.EndDate, p.PayDate, p.Frequency.ToString(), p.Status.ToString(),
        p.Batches?.Count ?? 0, p.Batches?.Sum(b => b.TotalGrossPay) ?? 0
    );
}
