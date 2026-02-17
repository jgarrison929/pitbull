namespace Pitbull.Reports.DTOs;

public sealed record ProjectProfitabilityReportResponse(
    DateOnly From,
    DateOnly To,
    IReadOnlyList<ProjectProfitabilityRow> Rows,
    ProjectProfitabilityTotals Totals);

public sealed record ProjectProfitabilityRow(
    Guid ProjectId,
    string ProjectNumber,
    string ProjectName,
    decimal Budget,
    decimal Revenue,
    decimal LaborCost,
    decimal EquipmentCost,
    decimal ActualCost,
    decimal Profit,
    decimal ProfitMarginPercent);

public sealed record ProjectProfitabilityTotals(
    decimal Budget,
    decimal Revenue,
    decimal LaborCost,
    decimal EquipmentCost,
    decimal ActualCost,
    decimal Profit,
    decimal ProfitMarginPercent);
