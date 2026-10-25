using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Services;

/// <summary>
/// Calculates labor costs for time entries.
/// Uses construction industry standard rates and burden calculations.
/// </summary>
public class LaborCostCalculator : ILaborCostCalculator
{
    /// <summary>
    /// Default burden rate (35%) - covers:
    /// - FICA (7.65%)
    /// - FUTA/SUTA (~2-3%)
    /// - Workers Comp (~5-15% for construction)
    /// - Health insurance allocation
    /// - Other benefits
    /// </summary>
    public const decimal DefaultBurdenRate = 0.35m;

    /// <summary>
    /// Overtime multiplier (1.5x base rate)
    /// </summary>
    public const decimal OvertimeMultiplier = 1.5m;

    /// <summary>
    /// Doubletime multiplier (2.0x base rate)
    /// </summary>
    public const decimal DoubletimeMultiplier = 2.0m;

    /// <inheritdoc />
    public LaborCostResult CalculateCost(TimeEntry timeEntry, Employee employee, decimal? burdenRate = null)
    {
        ArgumentNullException.ThrowIfNull(timeEntry);
        ArgumentNullException.ThrowIfNull(employee);

        var rate = employee.BaseHourlyRate;
        var burden = burdenRate ?? DefaultBurdenRate;

        // Calculate cost by hour type
        var regularCost = timeEntry.RegularHours * rate;
        var overtimeCost = timeEntry.OvertimeHours * rate * OvertimeMultiplier;
        var doubletimeCost = timeEntry.DoubletimeHours * rate * DoubletimeMultiplier;

        var baseWageCost = regularCost + overtimeCost + doubletimeCost;
        var burdenCost = baseWageCost * burden;

        return new LaborCostResult
        {
            BaseWageCost = Math.Round(baseWageCost, 2),
            BurdenCost = Math.Round(burdenCost, 2),
            BurdenRateApplied = burden,
            HoursBreakdown = new HoursCostBreakdown
            {
                RegularHours = timeEntry.RegularHours,
                RegularCost = Math.Round(regularCost, 2),
                OvertimeHours = timeEntry.OvertimeHours,
                OvertimeCost = Math.Round(overtimeCost, 2),
                DoubletimeHours = timeEntry.DoubletimeHours,
                DoubletimeCost = Math.Round(doubletimeCost, 2)
            }
        };
    }

    /// <inheritdoc />
    public LaborCostResult CalculateTotalCost(IEnumerable<TimeEntry> entries, decimal? burdenRate = null)
    {
        ArgumentNullException.ThrowIfNull(entries);

        var entriesList = entries.ToList();
        if (entriesList.Count == 0)
        {
            return new LaborCostResult
            {
                BaseWageCost = 0,
                BurdenCost = 0,
                BurdenRateApplied = burdenRate ?? DefaultBurdenRate,
                HoursBreakdown = new HoursCostBreakdown
                {
                    RegularHours = 0,
                    RegularCost = 0,
                    OvertimeHours = 0,
                    OvertimeCost = 0,
                    DoubletimeHours = 0,
                    DoubletimeCost = 0
                }
            };
        }

        // Aggregate all individual calculations
        decimal totalRegularHours = 0, totalRegularCost = 0;
        decimal totalOvertimeHours = 0, totalOvertimeCost = 0;
        decimal totalDoubletimeHours = 0, totalDoubletimeCost = 0;
        decimal totalBaseWage = 0, totalBurden = 0;

        foreach (var entry in entriesList)
        {
            if (entry.Employee == null)
            {
                throw new InvalidOperationException(
                    $"TimeEntry {entry.Id} does not have Employee navigation property loaded. " +
                    "Include Employee when querying time entries for cost calculation.");
            }

            var result = CalculateCost(entry, entry.Employee, burdenRate);

            totalRegularHours += result.HoursBreakdown.RegularHours;
            totalRegularCost += result.HoursBreakdown.RegularCost;
            totalOvertimeHours += result.HoursBreakdown.OvertimeHours;
            totalOvertimeCost += result.HoursBreakdown.OvertimeCost;
            totalDoubletimeHours += result.HoursBreakdown.DoubletimeHours;
            totalDoubletimeCost += result.HoursBreakdown.DoubletimeCost;
            totalBaseWage += result.BaseWageCost;
            totalBurden += result.BurdenCost;
        }

        return new LaborCostResult
        {
            BaseWageCost = totalBaseWage,
            BurdenCost = totalBurden,
            BurdenRateApplied = burdenRate ?? DefaultBurdenRate,
            HoursBreakdown = new HoursCostBreakdown
            {
                RegularHours = totalRegularHours,
                RegularCost = totalRegularCost,
                OvertimeHours = totalOvertimeHours,
                OvertimeCost = totalOvertimeCost,
                DoubletimeHours = totalDoubletimeHours,
                DoubletimeCost = totalDoubletimeCost
            }
        };
    }
}
