namespace Pitbull.Projects.Features.GetProjectPhases;

/// <summary>
/// DTO for project phase data returned by the API.
/// </summary>
public record PhaseDto(
    Guid Id,
    Guid ProjectId,
    string Name,
    string CostCode,
    string? Description,
    int SortOrder,
    decimal BudgetAmount,
    decimal ActualCost,
    decimal PercentComplete,
    string Status,
    DateTime? StartDate,
    DateTime? EndDate
);
