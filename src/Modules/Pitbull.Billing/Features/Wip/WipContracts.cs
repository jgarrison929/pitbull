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
    IReadOnlyList<WipReportLineDto> Lines,
    Guid? GlJournalEntryId = null,
    DateTime? PostedToGlAt = null,
    string? PostedToGlBy = null
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
    WipOverUnderClassification OverUnderClassification,
    // Earned Value fields
    decimal? EvPercentComplete = null,
    decimal? CostPerformanceIndex = null,
    decimal? SchedulePerformanceIndex = null,
    decimal? ProjectedGainLoss = null
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

public record WipGlPostResult(
    Guid WipReportId,
    Guid JournalEntryId,
    string JournalEntryNumber,
    decimal TotalDebits,
    decimal TotalCredits,
    int LineCount
);

/// <summary>
/// Surety-grade WIP schedule export DTO — the format bonding companies and controllers expect.
/// Columns follow the standard AIA / surety WIP schedule layout.
/// </summary>
public record WipSuretyExportDto(
    Guid WipReportId,
    DateOnly ReportDate,
    int FiscalYear,
    int PeriodNumber,
    string StatusName,
    IReadOnlyList<WipSuretyLineDto> Lines,
    // Portfolio totals
    decimal TotalContractAmount,
    decimal TotalCostToDate,
    decimal TotalEstimatedCostToComplete,
    decimal TotalEstimatedTotalCost,
    decimal TotalBilledToDate,
    decimal TotalEarnedRevenue,
    decimal TotalOverUnderBilling,
    decimal TotalProjectedGainLoss
);

/// <summary>Single project row on a surety WIP schedule.</summary>
public record WipSuretyLineDto(
    string ProjectNumber,
    string ProjectName,
    decimal ContractAmount,
    decimal ApprovedChangeOrders,
    decimal RevisedContractAmount,
    decimal TotalCostToDate,
    decimal EstimatedCostToComplete,
    decimal EstimatedTotalCost,
    decimal BilledToDate,
    decimal EarnedRevenue,
    decimal OverUnderBilling,
    WipOverUnderClassification OverUnderClassification,
    // Cost basis % complete
    decimal PercentComplete,
    // EV-enriched fields
    decimal? EvPercentComplete,
    decimal? CostPerformanceIndex,
    decimal? SchedulePerformanceIndex,
    // Profitability
    decimal ProjectedGainLoss,
    decimal GrossMarginPercent
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
