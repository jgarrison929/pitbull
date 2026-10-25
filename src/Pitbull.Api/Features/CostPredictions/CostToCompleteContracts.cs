namespace Pitbull.Api.Features.CostPredictions;

public sealed record CostToCompleteResult(
    Guid ProjectId,
    string ProjectName,
    string ProjectHealth,
    decimal TotalBudget,
    decimal TotalActualCost,
    decimal TotalPredictedEac,
    decimal OverallVariance,
    decimal OverallConfidence,
    int WarningCount,
    List<CostCodePredictionDto> CostCodes,
    DateTime GeneratedAt);

public sealed record CostCodePredictionDto(
    Guid CostCodeId,
    string CostCodeCode,
    string CostCodeDescription,
    decimal Budget,
    decimal ActualCost,
    decimal PredictedEac,
    decimal Variance,
    decimal VariancePercent,
    decimal Confidence,
    string TrendDirection,
    decimal DailyBurnRate,
    int? DaysUntilExhaustion,
    bool IsWarning);
