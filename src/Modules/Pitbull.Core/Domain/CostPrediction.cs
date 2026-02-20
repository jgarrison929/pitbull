namespace Pitbull.Core.Domain;

public class CostPrediction : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }

    public decimal PredictedFinalCost { get; set; }
    public decimal ConfidenceLevel { get; set; }
    public PredictionMethod PredictionMethod { get; set; }
    public decimal VarianceToBudget { get; set; }
    public decimal VariancePercent { get; set; }
    public decimal BudgetAtCompletion { get; set; }
    public decimal CostToDate { get; set; }
    public decimal EstimatedCostToComplete { get; set; }
    public decimal BurnRate { get; set; }
    public int DaysRemaining { get; set; }
    public string? Notes { get; set; }
}

// FROZEN -- DO NOT REORDER
public enum PredictionMethod
{
    LinearRegression = 0,
    EarnedValue = 1,
    WeightedAverage = 2,
    Historical = 3
}
