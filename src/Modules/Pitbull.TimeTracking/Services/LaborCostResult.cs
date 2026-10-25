namespace Pitbull.TimeTracking.Services;

/// <summary>
/// Result of a labor cost calculation for a time entry.
/// Breaks down the cost components for job costing and reporting.
/// </summary>
public record LaborCostResult
{
    /// <summary>
    /// Base wage cost (hours × rate, before burden)
    /// </summary>
    public decimal BaseWageCost { get; init; }

    /// <summary>
    /// Burden cost (taxes, insurance, benefits)
    /// </summary>
    public decimal BurdenCost { get; init; }

    /// <summary>
    /// Total labor cost (base + burden)
    /// </summary>
    public decimal TotalCost => BaseWageCost + BurdenCost;

    /// <summary>
    /// Breakdown by hour type
    /// </summary>
    public required HoursCostBreakdown HoursBreakdown { get; init; }

    /// <summary>
    /// The burden rate used for this calculation (e.g., 0.35 = 35%)
    /// </summary>
    public decimal BurdenRateApplied { get; init; }
}

/// <summary>
/// Cost breakdown by hour type (regular, overtime, doubletime)
/// </summary>
public record HoursCostBreakdown
{
    /// <summary>
    /// Regular hours worked
    /// </summary>
    public decimal RegularHours { get; init; }

    /// <summary>
    /// Cost of regular hours (hours × base rate)
    /// </summary>
    public decimal RegularCost { get; init; }

    /// <summary>
    /// Overtime hours worked
    /// </summary>
    public decimal OvertimeHours { get; init; }

    /// <summary>
    /// Cost of overtime hours (hours × base rate × 1.5)
    /// </summary>
    public decimal OvertimeCost { get; init; }

    /// <summary>
    /// Doubletime hours worked
    /// </summary>
    public decimal DoubletimeHours { get; init; }

    /// <summary>
    /// Cost of doubletime hours (hours × base rate × 2.0)
    /// </summary>
    public decimal DoubletimeCost { get; init; }
}
