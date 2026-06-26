using Pitbull.Core.Domain;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Billing.Services;

public static class OvertimeHoursCalculator
{
    public static (decimal Regular, decimal Overtime, decimal Doubletime) ClassifyEmployeeHours(
        IReadOnlyList<TimeEntry> entries,
        OvertimeSettings settings)
    {
        if (entries.Count == 0)
            return (0m, 0m, 0m);

        if (!settings.Enabled)
        {
            decimal totalHours = entries.Sum(e => e.TotalHours);
            return (totalHours, 0m, 0m);
        }

        decimal regularHours = 0m;
        decimal overtimeHours = 0m;
        decimal doubletimeHours = 0m;

        foreach (IGrouping<DateOnly, TimeEntry> dayGroup in entries.GroupBy(e => e.Date))
        {
            decimal dayTotal = dayGroup.Sum(e => e.TotalHours);
            (decimal dayRegular, decimal dayOvertime, decimal dayDoubletime) = ClassifyDailyHours(dayTotal, settings);
            regularHours += dayRegular;
            overtimeHours += dayOvertime;
            doubletimeHours += dayDoubletime;
        }

        if (regularHours > settings.WeeklyOtThreshold)
        {
            decimal weeklyExcess = regularHours - settings.WeeklyOtThreshold;
            regularHours = settings.WeeklyOtThreshold;
            overtimeHours += weeklyExcess;
        }

        return (regularHours, overtimeHours, doubletimeHours);
    }

    private static (decimal Regular, decimal Overtime, decimal Doubletime) ClassifyDailyHours(
        decimal dayTotal,
        OvertimeSettings settings)
    {
        if (dayTotal <= 0m)
            return (0m, 0m, 0m);

        decimal regular = Math.Min(dayTotal, settings.DailyOtThreshold);

        decimal overtime = 0m;
        if (dayTotal > settings.DailyOtThreshold && settings.DailyDtThreshold > settings.DailyOtThreshold)
        {
            overtime = Math.Min(dayTotal - settings.DailyOtThreshold, settings.DailyDtThreshold - settings.DailyOtThreshold);
        }
        else if (dayTotal > settings.DailyOtThreshold)
        {
            overtime = dayTotal - settings.DailyOtThreshold;
        }

        decimal doubletime = settings.DailyDtThreshold > 0m && dayTotal > settings.DailyDtThreshold
            ? dayTotal - settings.DailyDtThreshold
            : 0m;

        return (regular, overtime, doubletime);
    }
}