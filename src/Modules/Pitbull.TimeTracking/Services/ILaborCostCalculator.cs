using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Services;

/// <summary>
/// Service for calculating labor costs from time entries.
/// Handles rate calculations, burden application, and cost breakdowns.
/// </summary>
public interface ILaborCostCalculator
{
    LaborCostResult CalculateCost(TimeEntry timeEntry, Employee employee, decimal? burdenRate = null);

    Task<LaborCostResult> CalculateCostAsync(
        TimeEntry timeEntry,
        Employee employee,
        decimal? burdenRate = null,
        CancellationToken cancellationToken = default);

    LaborCostResult CalculateTotalCost(IEnumerable<TimeEntry> entries, decimal? burdenRate = null);

    Task<LaborCostResult> CalculateTotalCostAsync(
        IEnumerable<TimeEntry> entries,
        decimal? burdenRate = null,
        CancellationToken cancellationToken = default);
}
