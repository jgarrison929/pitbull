using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Features.Wip;

public record WipReportDto(
    Guid Id,
    DateOnly ReportDate,
    int FiscalYear,
    int PeriodNumber,
    WipReportStatus Status,
    string StatusName,
    string GeneratedById,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    IReadOnlyList<WipReportLineDto> Lines
);

public record WipReportListItemDto(
    Guid Id,
    DateOnly ReportDate,
    int FiscalYear,
    int PeriodNumber,
    WipReportStatus Status,
    string StatusName,
    int LineCount,
    DateTime CreatedAt
);

public record WipReportLineDto(
    Guid Id,
    Guid WipReportId,
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

public enum WipOverUnderClassification
{
    Flat = 0,
    UnderBilled = 1,
    OverBilled = 2
}

public record WipProjectEstimateInput(Guid ProjectId, decimal EstimatedCostToComplete);

public record CreateWipReportCommand(
    DateOnly ReportDate,
    int FiscalYear,
    int PeriodNumber,
    WipReportStatus Status = WipReportStatus.Draft,
    IReadOnlyList<CreateWipReportLineCommand>? Lines = null
) : ICommand<WipReportDto>;

public record CreateWipReportLineCommand(
    Guid ProjectId,
    decimal ContractAmount,
    decimal ApprovedChangeOrders,
    decimal RevisedContractAmount,
    decimal TotalCostToDate,
    decimal EstimatedCostToComplete,
    decimal EstimatedTotalCost,
    decimal PercentComplete,
    decimal EarnedRevenue,
    decimal BilledToDate,
    decimal OverUnderBilling
);

public record UpdateWipReportCommand(
    Guid WipReportId,
    WipReportStatus? Status = null,
    IReadOnlyList<UpdateWipReportLineCommand>? Lines = null
) : ICommand<WipReportDto>;

public record UpdateWipReportLineCommand(
    Guid WipReportLineId,
    decimal? EstimatedCostToComplete = null
);

public record GenerateWipReportCommand(
    DateOnly ReportDate,
    int FiscalYear,
    int PeriodNumber,
    IReadOnlyList<WipProjectEstimateInput>? ProjectEstimates = null,
    WipReportStatus Status = WipReportStatus.Draft
) : ICommand<WipReportDto>;

public record ListWipReportsQuery(
    WipReportStatus? Status = null,
    int Page = 1,
    int PageSize = 25
) : IQuery<ListWipReportsResult>;

public record ListWipReportsResult(
    IReadOnlyList<WipReportListItemDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);

public static class WipMapper
{
    public static WipOverUnderClassification ClassifyOverUnder(decimal overUnderBilling)
    {
        if (overUnderBilling > 0m)
            return WipOverUnderClassification.UnderBilled;

        if (overUnderBilling < 0m)
            return WipOverUnderClassification.OverBilled;

        return WipOverUnderClassification.Flat;
    }
}
