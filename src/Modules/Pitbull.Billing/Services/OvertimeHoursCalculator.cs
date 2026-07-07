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

        if (settings.CaliforniaOtRules)
            (regularHours, overtimeHours, doubletimeHours) = ApplyCaliforniaSeventhDayRule(
                entries, regularHours, overtimeHours, doubletimeHours, settings);

        return (regularHours, overtimeHours, doubletimeHours);
    }

    /// <summary>
    /// California 7th consecutive work day: first 8 hours OT, beyond 8 DT (no regular).
    /// </summary>
    private static (decimal Regular, decimal Overtime, decimal Doubletime) ApplyCaliforniaSeventhDayRule(
        IReadOnlyList<TimeEntry> entries,
        decimal regularHours,
        decimal overtimeHours,
        decimal doubletimeHours,
        OvertimeSettings settings)
    {
        var daysWithHours = entries
            .GroupBy(e => e.Date)
            .Where(g => g.Sum(e => e.TotalHours) > 0)
            .OrderBy(g => g.Key)
            .Select(g => (Date: g.Key, Total: g.Sum(e => e.TotalHours)))
            .ToList();

        if (daysWithHours.Count < 7)
            return (regularHours, overtimeHours, doubletimeHours);

        int streak = 1;
        for (int i = 1; i < daysWithHours.Count; i++)
        {
            if (daysWithHours[i].Date == daysWithHours[i - 1].Date.AddDays(1))
                streak++;
            else
                streak = 1;

            if (streak < 7)
                continue;

            decimal dayTotal = daysWithHours[i].Total;
            (decimal dayRegular, decimal dayOvertime, decimal dayDoubletime) = ClassifyDailyHours(dayTotal, settings);

            regularHours -= dayRegular;
            overtimeHours -= dayOvertime;
            doubletimeHours -= dayDoubletime;

            decimal seventhOt = Math.Min(dayTotal, 8m);
            decimal seventhDt = Math.Max(dayTotal - 8m, 0m);
            overtimeHours += seventhOt;
            doubletimeHours += seventhDt;
        }

        regularHours = Math.Max(regularHours, 0m);
        overtimeHours = Math.Max(overtimeHours, 0m);
        doubletimeHours = Math.Max(doubletimeHours, 0m);
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