namespace Pitbull.Reports.DTOs;

public sealed record LaborCostReportResponse(
    DateOnly From,
    DateOnly To,
    string GroupBy,
    Guid? ProjectId,
    IReadOnlyList<LaborCostReportRow> Rows,
    LaborCostSummary Totals,
    IReadOnlyList<LaborCostSubtotal> Subtotals);

public sealed record LaborCostReportRow(
    string GroupKey,
    string GroupLabel,
    decimal TotalHours,
    decimal RegularHours,
    decimal OvertimeHours,
    decimal TotalCost);

public sealed record LaborCostSummary(
    decimal TotalHours,
    decimal RegularHours,
    decimal OvertimeHours,
    decimal TotalCost);

public sealed record LaborCostSubtotal(
    string Label,
    decimal TotalHours,
    decimal RegularHours,
    decimal OvertimeHours,
    decimal TotalCost);
