namespace Pitbull.Reports.DTOs;

public sealed record WeeklySummaryReportResponse(
    DateOnly WeekOf,
    DateOnly WeekStart,
    DateOnly WeekEnd,
    Guid? ProjectId,
    IReadOnlyList<WeeklySummaryDay> Days,
    IReadOnlyList<WeeklySummaryRow> Rows,
    WeeklySummaryTotals Totals);

public sealed record WeeklySummaryDay(
    string Label,
    DateOnly Date);

public sealed record WeeklySummaryRow(
    Guid EmployeeId,
    string EmployeeNumber,
    string EmployeeName,
    IReadOnlyList<decimal> DayHours,
    decimal WeeklyTotal);

public sealed record WeeklySummaryTotals(
    IReadOnlyList<decimal> DayHours,
    decimal WeeklyTotal);
