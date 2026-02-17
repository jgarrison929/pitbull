namespace Pitbull.Reports.DTOs;

public sealed record EquipmentUtilizationReportResponse(
    DateOnly From,
    DateOnly To,
    int WorkDays,
    IReadOnlyList<EquipmentUtilizationRow> Rows,
    EquipmentUtilizationTotals Totals);

public sealed record EquipmentUtilizationRow(
    Guid EquipmentId,
    string EquipmentCode,
    string EquipmentName,
    string EquipmentType,
    decimal TotalHoursUsed,
    int DaysAssigned,
    decimal UtilizationPercent,
    decimal Cost);

public sealed record EquipmentUtilizationTotals(
    decimal TotalHoursUsed,
    int TotalDaysAssigned,
    decimal TotalCost,
    decimal AverageUtilizationPercent);
