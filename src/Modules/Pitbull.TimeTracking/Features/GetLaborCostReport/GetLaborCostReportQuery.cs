using MediatR;
using Pitbull.Core.CQRS;
using Pitbull.TimeTracking.Services;

namespace Pitbull.TimeTracking.Features.GetLaborCostReport;

/// <summary>
/// Query to get labor cost report for a project or across projects.
/// Aggregates time entries into cost summaries by cost code.
/// </summary>
public record GetLaborCostReportQuery(
    Guid? ProjectId = null,
    DateOnly? StartDate = null,
    DateOnly? EndDate = null,
    bool ApprovedOnly = true
) : IRequest<Result<LaborCostReportResponse>>;

/// <summary>
/// Labor cost report response with project-level and cost-code-level breakdowns.
/// </summary>
public record LaborCostReportResponse
{
    /// <summary>
    /// Report generation timestamp
    /// </summary>
    public DateTime GeneratedAt { get; init; } = DateTime.UtcNow;

    /// <summary>
    /// Date range of the report
    /// </summary>
    public required DateRangeInfo DateRange { get; init; }

    /// <summary>
    /// Filter: approved entries only, or all statuses
    /// </summary>
    public bool ApprovedOnly { get; init; }

    /// <summary>
    /// Total labor cost across all included entries
    /// </summary>
    public required LaborCostSummary TotalCost { get; init; }

    /// <summary>
    /// Breakdown by project (if multiple projects included)
    /// </summary>
    public required IReadOnlyList<ProjectCostSummary> ByProject { get; init; }
}

/// <summary>
/// Date range for the report
/// </summary>
public record DateRangeInfo(DateOnly? StartDate, DateOnly? EndDate);

/// <summary>
/// Labor cost summary totals
/// </summary>
public record LaborCostSummary
{
    public decimal TotalHours { get; init; }
    public decimal RegularHours { get; init; }
    public decimal OvertimeHours { get; init; }
    public decimal DoubletimeHours { get; init; }
    public decimal BaseWageCost { get; init; }
    public decimal BurdenCost { get; init; }
    public decimal TotalCost { get; init; }
    public decimal BurdenRateApplied { get; init; }
}

/// <summary>
/// Cost summary for a single project
/// </summary>
public record ProjectCostSummary
{
    public required Guid ProjectId { get; init; }
    public required string ProjectName { get; init; }
    public required string? ProjectNumber { get; init; }
    public required LaborCostSummary Cost { get; init; }
    public required IReadOnlyList<CostCodeCostSummary> ByCostCode { get; init; }
}

/// <summary>
/// Cost summary for a single cost code within a project
/// </summary>
public record CostCodeCostSummary
{
    public required Guid CostCodeId { get; init; }
    public required string CostCodeNumber { get; init; }
    public required string CostCodeName { get; init; }
    public required LaborCostSummary Cost { get; init; }
}
