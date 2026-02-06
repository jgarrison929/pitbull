using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Services;

/// <summary>
/// Service for calculating labor costs from time entries.
/// Handles rate calculations, burden application, and cost breakdowns.
/// </summary>
public interface ILaborCostCalculator
{
    /// <summary>
    /// Calculate the total labor cost for a single time entry.
    /// </summary>
    /// <param name="timeEntry">The time entry to calculate cost for</param>
    /// <param name="employee">The employee with rate information</param>
    /// <param name="burdenRate">Optional override for burden rate (default uses standard rate)</param>
    /// <returns>Detailed cost breakdown</returns>
    LaborCostResult CalculateCost(TimeEntry timeEntry, Employee employee, decimal? burdenRate = null);

    /// <summary>
    /// Calculate total labor cost for multiple time entries.
    /// </summary>
    /// <param name="entries">Time entries with their associated employees loaded</param>
    /// <param name="burdenRate">Optional override for burden rate</param>
    /// <returns>Aggregated cost result</returns>
    LaborCostResult CalculateTotalCost(IEnumerable<TimeEntry> entries, decimal? burdenRate = null);
}
