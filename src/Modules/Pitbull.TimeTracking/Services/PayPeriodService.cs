using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Services;

/// <summary>
/// Implementation of pay period calculations and management
/// </summary>
public class PayPeriodService(PitbullDbContext db) : IPayPeriodService
{
    public (DateOnly StartDate, DateOnly EndDate) CalculatePeriodBoundaries(DateOnly date, PayPeriodConfiguration config)
    {
        return config.Type switch
        {
            PayPeriodType.Weekly => CalculateWeeklyPeriod(date, config.WeekStartDay),
            PayPeriodType.BiWeekly => CalculateBiWeeklyPeriod(date, config.WeekStartDay, config.BiWeeklyReferenceDate),
            PayPeriodType.SemiMonthly => CalculateSemiMonthlyPeriod(date, config.SemiMonthlyFirstDay, config.SemiMonthlySecondDay),
            PayPeriodType.Monthly => CalculateMonthlyPeriod(date),
            _ => throw new ArgumentOutOfRangeException(nameof(config.Type), config.Type, "Unknown pay period type")
        };
    }

    public List<(DateOnly StartDate, DateOnly EndDate)> GenerateFuturePeriods(
        PayPeriodConfiguration config,
        DateOnly fromDate,
        int periodsAhead)
    {
        var periods = new List<(DateOnly StartDate, DateOnly EndDate)>();
        
        // Get the period containing fromDate
        var (currentStart, currentEnd) = CalculatePeriodBoundaries(fromDate, config);
        periods.Add((currentStart, currentEnd));

        // Generate future periods
        for (int i = 0; i < periodsAhead; i++)
        {
            var nextDate = currentEnd.AddDays(1);
            var (nextStart, nextEnd) = CalculatePeriodBoundaries(nextDate, config);
            periods.Add((nextStart, nextEnd));
            currentEnd = nextEnd;
        }

        return periods;
    }

    public async Task<bool> IsDateInLockedPeriodAsync(DateOnly date, CancellationToken cancellationToken = default)
    {
        var period = await GetPayPeriodForDateAsync(date, cancellationToken);
        return period?.IsLocked ?? false;
    }

    public async Task<PayPeriod?> GetPayPeriodForDateAsync(DateOnly date, CancellationToken cancellationToken = default)
    {
        return await db.Set<PayPeriod>()
            .Where(p => p.StartDate <= date && p.EndDate >= date)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<string?> ValidateTimeEntryDateAsync(DateOnly date, CancellationToken cancellationToken = default)
    {
        // Check if enforcement is enabled for this tenant
        var config = await db.Set<PayPeriodConfiguration>()
            .FirstOrDefaultAsync(cancellationToken);

        // If no config or enforcement disabled, allow the entry
        if (config == null || !config.EnforcementEnabled)
            return null;

        // Check if date falls in a locked period
        var period = await GetPayPeriodForDateAsync(date, cancellationToken);
        
        if (period != null && period.IsLocked)
        {
            return $"Time entries cannot be modified for locked pay period ({period.StartDate:MMM d} - {period.EndDate:MMM d, yyyy})";
        }

        return null;
    }

    private static (DateOnly StartDate, DateOnly EndDate) CalculateWeeklyPeriod(DateOnly date, DayOfWeek weekStartDay)
    {
        // Find the start of the week
        var daysToSubtract = ((int)date.DayOfWeek - (int)weekStartDay + 7) % 7;
        var startDate = date.AddDays(-daysToSubtract);
        var endDate = startDate.AddDays(6);
        
        return (startDate, endDate);
    }

    private static (DateOnly StartDate, DateOnly EndDate) CalculateBiWeeklyPeriod(
        DateOnly date, 
        DayOfWeek weekStartDay, 
        DateOnly? referenceDate)
    {
        // Use reference date or default to a known Sunday (Jan 1, 2024 was a Monday, so use Dec 31, 2023)
        var reference = referenceDate ?? new DateOnly(2023, 12, 31);
        
        // Adjust reference to start on the correct weekStartDay
        var refDaysToSubtract = ((int)reference.DayOfWeek - (int)weekStartDay + 7) % 7;
        reference = reference.AddDays(-refDaysToSubtract);
        
        // Calculate days since reference
        var daysSinceReference = date.DayNumber - reference.DayNumber;
        
        // Find which bi-weekly period we're in
        var periodNumber = daysSinceReference / 14;
        if (daysSinceReference < 0)
            periodNumber--; // Adjust for dates before reference
            
        var startDate = reference.AddDays(periodNumber * 14);
        var endDate = startDate.AddDays(13);
        
        return (startDate, endDate);
    }

    private static (DateOnly StartDate, DateOnly EndDate) CalculateSemiMonthlyPeriod(
        DateOnly date, 
        int firstDay, 
        int secondDay)
    {
        var year = date.Year;
        var month = date.Month;
        var day = date.Day;
        
        // Ensure days are valid (handle month-end scenarios)
        var daysInMonth = DateTime.DaysInMonth(year, month);
        var actualSecondDay = Math.Min(secondDay, daysInMonth);
        var firstEndDay = actualSecondDay - 1;
        
        if (day < actualSecondDay)
        {
            // First half of month
            var startDate = new DateOnly(year, month, firstDay);
            var endDate = new DateOnly(year, month, firstEndDay);
            return (startDate, endDate);
        }
        else
        {
            // Second half of month
            var startDate = new DateOnly(year, month, actualSecondDay);
            var endDate = new DateOnly(year, month, daysInMonth);
            return (startDate, endDate);
        }
    }

    private static (DateOnly StartDate, DateOnly EndDate) CalculateMonthlyPeriod(DateOnly date)
    {
        var startDate = new DateOnly(date.Year, date.Month, 1);
        var daysInMonth = DateTime.DaysInMonth(date.Year, date.Month);
        var endDate = new DateOnly(date.Year, date.Month, daysInMonth);
        
        return (startDate, endDate);
    }
}
