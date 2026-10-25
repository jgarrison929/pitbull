namespace Pitbull.Api.Features.TodayOnSite;

/// <summary>
/// Today-on-site glance DTO (3.3.x). Real entity counts only — never portfolio KPIs.
/// Day boundary: UTC calendar day of <see cref="DayUtc"/> unless documented otherwise.
/// </summary>
public sealed record TodayOnSiteDto(
    Guid ProjectId,
    DateOnly DayUtc,
    int DailyReportCount,
    int PhotoCount,
    int OpenRfiCount,
    string Label);

/// <summary>UTC day window for "today" activity (honest empty allowed).</summary>
public static class TodayOnSiteDay
{
    public static (DateTime StartUtc, DateTime EndExclusiveUtc, DateOnly Day) UtcDayWindow(DateTime utcNow)
    {
        var day = DateOnly.FromDateTime(DateTime.SpecifyKind(utcNow, DateTimeKind.Utc));
        var start = day.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var end = start.AddDays(1);
        return (start, end, day);
    }

    public static string ActivityLabel => "Today's field activity";
}
