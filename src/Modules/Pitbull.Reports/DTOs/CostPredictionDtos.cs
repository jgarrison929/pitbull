namespace Pitbull.Reports.DTOs;

public sealed record CostPredictionDto(
    Guid Id,
    Guid ProjectId,
    string ProjectName,
    decimal PredictedFinalCost,
    decimal ConfidenceLevel,
    string PredictionMethod,
    decimal VarianceToBudget,
    decimal VariancePercent,
    decimal BudgetAtCompletion,
    decimal CostToDate,
    decimal EstimatedCostToComplete,
    decimal BurnRate,
    int DaysRemaining,
    string? Notes,
    DateTime CreatedAt);
