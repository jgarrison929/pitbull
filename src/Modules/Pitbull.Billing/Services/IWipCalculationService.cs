using Pitbull.Billing.Features.Wip;
using Pitbull.Core.CQRS;
using Pitbull.Projects.Domain;

namespace Pitbull.Billing.Services;

public interface IWipCalculationService
{
    Task<Result<WipReportLineCalculationResult>> CalculateProjectLineAsync(
        Project project,
        decimal estimatedCostToComplete,
        CancellationToken cancellationToken = default);
}

public record WipReportLineCalculationResult(
    Guid ProjectId,
    string ProjectNumber,
    string ProjectName,
    decimal ContractAmount,
    decimal ApprovedChangeOrders,
    decimal RevisedContractAmount,
    decimal TotalCostToDate,
    decimal EstimatedCostToComplete,
    decimal EstimatedTotalCost,
    decimal PercentComplete,
    decimal EarnedRevenue,
    decimal BilledToDate,
    decimal OverUnderBilling,
    WipOverUnderClassification OverUnderClassification
);
