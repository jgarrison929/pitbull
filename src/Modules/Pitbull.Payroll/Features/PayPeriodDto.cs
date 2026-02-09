namespace Pitbull.Payroll.Features;

public record PayPeriodDto(
    Guid Id, DateOnly StartDate, DateOnly EndDate, DateOnly PayDate, string Frequency, string Status,
    string? ProcessedBy, DateTime? ProcessedAt, string? ApprovedBy, DateTime? ApprovedAt,
    string? Notes, int BatchCount, DateTime CreatedAt, DateTime? UpdatedAt
);

public record PayPeriodListDto(
    Guid Id, DateOnly StartDate, DateOnly EndDate, DateOnly PayDate, string Frequency,
    string Status, int BatchCount, decimal TotalGrossPay
);
