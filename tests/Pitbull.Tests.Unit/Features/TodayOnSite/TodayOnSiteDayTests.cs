using Pitbull.Api.Features.TodayOnSite;
using Xunit;

namespace Pitbull.Tests.Unit.Features.TodayOnSite;

public class TodayOnSiteDayTests
{
    [Fact]
    public void UtcDayWindow_is_half_open_utc_day()
    {
        var now = new DateTime(2026, 7, 15, 18, 30, 0, DateTimeKind.Utc);
        var (start, end, day) = TodayOnSiteDay.UtcDayWindow(now);
        Assert.Equal(new DateOnly(2026, 7, 15), day);
        Assert.Equal(new DateTime(2026, 7, 15, 0, 0, 0, DateTimeKind.Utc), start);
        Assert.Equal(new DateTime(2026, 7, 16, 0, 0, 0, DateTimeKind.Utc), end);
    }

    [Fact]
    public void Label_is_not_health_score()
    {
        Assert.DoesNotContain("health", TodayOnSiteDay.ActivityLabel, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Empty_dto_is_honest_zeroes()
    {
        var dto = new TodayOnSiteDto(Guid.NewGuid(), new DateOnly(2026, 7, 15), 0, 0, 0, TodayOnSiteDay.ActivityLabel);
        Assert.Equal(0, dto.DailyReportCount);
        Assert.Equal(0, dto.PhotoCount);
        Assert.Equal(0, dto.OpenRfiCount);
    }
}
