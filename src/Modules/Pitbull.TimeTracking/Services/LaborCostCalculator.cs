using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Services;

/// <summary>
/// Calculates labor costs for time entries.
/// Posted slips and IWageRateResolver quotes replace the 35% proxy when available.
/// </summary>
public class LaborCostCalculator : ILaborCostCalculator
{
    /// <summary>
    /// Fallback proxy burden (35%). Not used for posted cost or when employer components exist.
    /// </summary>
    public const decimal DefaultBurdenRate = 0.35m;

    public const decimal OvertimeMultiplier = 1.5m;
    public const decimal DoubletimeMultiplier = 2.0m;

    private readonly ILaborCostRateSource? _rateSource;

    public LaborCostCalculator() : this(null)
    {
    }

    public LaborCostCalculator(ILaborCostRateSource? rateSource)
    {
        _rateSource = rateSource;
    }

    /// <inheritdoc />
    public LaborCostResult CalculateCost(TimeEntry timeEntry, Employee employee, decimal? burdenRate = null)
    {
        ArgumentNullException.ThrowIfNull(timeEntry);
        ArgumentNullException.ThrowIfNull(employee);

        return CalculateFromRate(
            timeEntry,
            employee.BaseHourlyRate,
            OvertimeMultiplier,
            DoubletimeMultiplier,
            employerHourlyBurden: 0m,
            burdenRateOverride: burdenRate,
            isProxy: burdenRate is null);
    }

    /// <inheritdoc />
    public async Task<LaborCostResult> CalculateCostAsync(
        TimeEntry timeEntry,
        Employee employee,
        decimal? burdenRate = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(timeEntry);
        ArgumentNullException.ThrowIfNull(employee);

        if (_rateSource is not null)
        {
            LaborRateQuote? quote = await _rateSource.QuoteAsync(timeEntry, employee, cancellationToken);
            if (quote is not null)
            {
                if (quote.IsPosted && quote.PostedBaseWage.HasValue)
                {
                    return new LaborCostResult
                    {
                        BaseWageCost = Math.Round(quote.PostedBaseWage.Value, 2),
                        BurdenCost = Math.Round(quote.PostedBurden ?? 0m, 2),
                        BurdenRateApplied = quote.PostedBaseWage.Value == 0m
                            ? 0m
                            : Math.Round((quote.PostedBurden ?? 0m) / quote.PostedBaseWage.Value, 4),
                        IsProxy = false,
                        HoursBreakdown = new HoursCostBreakdown
                        {
                            RegularHours = timeEntry.RegularHours,
                            RegularCost = 0m,
                            OvertimeHours = timeEntry.OvertimeHours,
                            OvertimeCost = 0m,
                            DoubletimeHours = timeEntry.DoubletimeHours,
                            DoubletimeCost = 0m
                        }
                    };
                }

                decimal? overrideBurden = burdenRate;
                decimal employerAsRate = quote.RegularRate > 0m
                    ? quote.EmployerHourlyBurden / quote.RegularRate
                    : 0m;

                return CalculateFromRate(
                    timeEntry,
                    quote.RegularRate,
                    quote.OvertimeMultiplier,
                    quote.DoubletimeMultiplier,
                    employerHourlyBurden: quote.EmployerHourlyBurden,
                    burdenRateOverride: overrideBurden ?? (quote.IsProxy ? DefaultBurdenRate : employerAsRate),
                    isProxy: quote.IsProxy && overrideBurden is null,
                    applyEmployerHourly: !quote.IsProxy && overrideBurden is null);
            }
        }

        return CalculateCost(timeEntry, employee, burdenRate);
    }

    /// <inheritdoc />
    public LaborCostResult CalculateTotalCost(IEnumerable<TimeEntry> entries, decimal? burdenRate = null)
    {
        ArgumentNullException.ThrowIfNull(entries);

        var entriesList = entries.ToList();
        if (entriesList.Count == 0)
        {
            return EmptyResult(burdenRate ?? DefaultBurdenRate, isProxy: burdenRate is null);
        }

        decimal totalRegularHours = 0, totalRegularCost = 0;
        decimal totalOvertimeHours = 0, totalOvertimeCost = 0;
        decimal totalDoubletimeHours = 0, totalDoubletimeCost = 0;
        decimal totalBaseWage = 0, totalBurden = 0;
        bool anyProxy = false;

        foreach (var entry in entriesList)
        {
            if (entry.Employee == null)
            {
                throw new InvalidOperationException(
                    $"TimeEntry {entry.Id} does not have Employee navigation property loaded. " +
                    "Include Employee when querying time entries for cost calculation.");
            }

            var result = CalculateCost(entry, entry.Employee, burdenRate);
            anyProxy |= result.IsProxy;

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
            IsProxy = anyProxy,
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

    /// <inheritdoc />
    public async Task<LaborCostResult> CalculateTotalCostAsync(
        IEnumerable<TimeEntry> entries,
        decimal? burdenRate = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(entries);

        var entriesList = entries.ToList();
        if (entriesList.Count == 0)
        {
            return EmptyResult(burdenRate ?? DefaultBurdenRate, isProxy: burdenRate is null);
        }

        decimal totalRegularHours = 0, totalRegularCost = 0;
        decimal totalOvertimeHours = 0, totalOvertimeCost = 0;
        decimal totalDoubletimeHours = 0, totalDoubletimeCost = 0;
        decimal totalBaseWage = 0, totalBurden = 0;
        bool anyProxy = false;
        decimal lastBurdenRate = burdenRate ?? DefaultBurdenRate;

        foreach (var entry in entriesList)
        {
            if (entry.Employee == null)
            {
                throw new InvalidOperationException(
                    $"TimeEntry {entry.Id} does not have Employee navigation property loaded. " +
                    "Include Employee when querying time entries for cost calculation.");
            }

            var result = await CalculateCostAsync(entry, entry.Employee, burdenRate, cancellationToken);
            anyProxy |= result.IsProxy;
            lastBurdenRate = result.BurdenRateApplied;

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
            BurdenRateApplied = lastBurdenRate,
            IsProxy = anyProxy,
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

    private static LaborCostResult CalculateFromRate(
        TimeEntry timeEntry,
        decimal rate,
        decimal overtimeMultiplier,
        decimal doubletimeMultiplier,
        decimal employerHourlyBurden,
        decimal? burdenRateOverride,
        bool isProxy,
        bool applyEmployerHourly = false)
    {
        var regularCost = timeEntry.RegularHours * rate;
        var overtimeCost = timeEntry.OvertimeHours * rate * overtimeMultiplier;
        var doubletimeCost = timeEntry.DoubletimeHours * rate * doubletimeMultiplier;

        var baseWageCost = regularCost + overtimeCost + doubletimeCost;
        decimal burdenCost;
        decimal burdenRateApplied;

        if (applyEmployerHourly)
        {
            decimal hours = timeEntry.RegularHours + timeEntry.OvertimeHours + timeEntry.DoubletimeHours;
            burdenCost = hours * employerHourlyBurden;
            burdenRateApplied = rate == 0m ? 0m : Math.Round(employerHourlyBurden / rate, 4);
        }
        else
        {
            var burden = burdenRateOverride ?? DefaultBurdenRate;
            burdenCost = baseWageCost * burden;
            burdenRateApplied = burden;
        }

        return new LaborCostResult
        {
            BaseWageCost = Math.Round(baseWageCost, 2),
            BurdenCost = Math.Round(burdenCost, 2),
            BurdenRateApplied = burdenRateApplied,
            IsProxy = isProxy,
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

    private static LaborCostResult EmptyResult(decimal burdenRate, bool isProxy) => new()
    {
        BaseWageCost = 0,
        BurdenCost = 0,
        BurdenRateApplied = burdenRate,
        IsProxy = isProxy,
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
