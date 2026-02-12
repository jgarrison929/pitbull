namespace Pitbull.Projects.Features.GetProjectRfiCostSummary;

/// <summary>
/// Summary of RFI cost impact across an entire project.
/// </summary>
public record ProjectRfiCostSummaryDto(
    Guid ProjectId,
    string ProjectName,
    string ProjectNumber,
    
    // RFI counts
    int TotalRfis,
    int OpenRfis,
    int RfisWithCostImpact,
    int OverdueRfis,
    
    // Cost totals
    decimal TotalDirectCost,
    decimal TotalDelayCost,
    decimal TotalCost,
    
    // Time metrics
    int TotalDelayDays,
    double AverageResolutionDays,
    
    // Top costly RFIs
    List<TopCostlyRfiDto> TopCostlyRfis
);

/// <summary>
/// Summary of a high-cost RFI for the top list.
/// </summary>
public record TopCostlyRfiDto(
    Guid Id,
    int Number,
    string Subject,
    decimal TotalCost,
    int DaysOpen
);
