using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Services;

/// <summary>
/// Optional rate source for labor cost. Payroll supplies posted slips or IWageRateResolver quotes.
/// TimeTracking must not reference Payroll.
/// </summary>
public interface ILaborCostRateSource
{
    Task<LaborRateQuote?> QuoteAsync(TimeEntry timeEntry, Employee employee, CancellationToken cancellationToken = default);
}

public sealed record LaborRateQuote(
    decimal RegularRate,
    decimal OvertimeMultiplier,
    decimal DoubletimeMultiplier,
    decimal EmployerHourlyBurden,
    bool IsPosted,
    bool IsProxy,
    decimal? PostedBaseWage = null,
    decimal? PostedBurden = null);
