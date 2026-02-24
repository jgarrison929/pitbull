using Pitbull.Api.Services;

namespace Pitbull.Tests.Unit;

public class BriefingServiceTests
{
    [Theory]
    [InlineData("America/Los_Angeles", 8, "Good morning, Josh")]    // 8 AM Pacific
    [InlineData("America/Los_Angeles", 14, "Good afternoon, Josh")] // 2 PM Pacific
    [InlineData("America/Los_Angeles", 20, "Good evening, Josh")]   // 8 PM Pacific
    [InlineData("America/New_York", 8, "Good morning, Josh")]       // 8 AM Eastern
    [InlineData("America/New_York", 14, "Good afternoon, Josh")]    // 2 PM Eastern
    [InlineData("America/New_York", 20, "Good evening, Josh")]      // 8 PM Eastern
    [InlineData("Europe/London", 10, "Good morning, Josh")]         // 10 AM London
    [InlineData("Asia/Tokyo", 18, "Good evening, Josh")]            // 6 PM Tokyo
    public void BuildGreeting_UsesCompanyTimezone(string timezoneId, int localHour, string expected)
    {
        // Arrange: Create a UTC time that, when converted to the given timezone, equals localHour
        var zone = TimeZoneInfo.FindSystemTimeZoneById(timezoneId);
        var localTime = new DateTime(2026, 2, 24, localHour, 30, 0, DateTimeKind.Unspecified);
        var utcTime = TimeZoneInfo.ConvertTimeToUtc(localTime, zone);

        // Act
        var result = BriefingService.BuildGreeting("Josh Garrison", utcTime, timezoneId);

        // Assert
        Assert.Equal(expected, result);
    }

    [Fact]
    public void BuildGreeting_DefaultsToPackific_WhenNoTimezoneSpecified()
    {
        // 10 AM UTC = 2 AM Pacific (winter) — should be "Good morning" in Pacific
        var utcTime = new DateTime(2026, 2, 24, 10, 0, 0, DateTimeKind.Utc);

        var result = BriefingService.BuildGreeting("Josh Garrison", utcTime);

        // 10 AM UTC = 2 AM PST → "Good morning"
        Assert.StartsWith("Good morning", result);
    }

    [Fact]
    public void BuildGreeting_FallsBack_WhenTimezoneInvalid()
    {
        var utcTime = new DateTime(2026, 2, 24, 10, 0, 0, DateTimeKind.Utc);

        var result = BriefingService.BuildGreeting("Taya Garrison", utcTime, "Invalid/Timezone");

        Assert.Equal("Welcome back, Taya", result);
    }

    [Fact]
    public void BuildGreeting_ExtractsFirstName()
    {
        var utcTime = new DateTime(2026, 2, 24, 20, 0, 0, DateTimeKind.Utc); // noon Pacific

        var result = BriefingService.BuildGreeting("Josh Garrison", utcTime, "America/Los_Angeles");

        // 20 UTC = 12 PM PST → "Good afternoon"
        Assert.Equal("Good afternoon, Josh", result);
    }

    [Fact]
    public void BuildGreeting_HandlesSingleName()
    {
        var utcTime = new DateTime(2026, 2, 24, 20, 0, 0, DateTimeKind.Utc);

        var result = BriefingService.BuildGreeting("Josh", utcTime, "America/Los_Angeles");

        Assert.Equal("Good afternoon, Josh", result);
    }

    [Theory]
    [InlineData(0, "Good morning")]   // midnight
    [InlineData(5, "Good morning")]   // 5 AM
    [InlineData(11, "Good morning")]  // 11 AM
    [InlineData(12, "Good afternoon")]// noon
    [InlineData(16, "Good afternoon")]// 4 PM
    [InlineData(17, "Good evening")]  // 5 PM
    [InlineData(23, "Good evening")]  // 11 PM
    public void BuildGreeting_CorrectTimeOfDay_BoundaryTests(int hour, string expectedPrefix)
    {
        // Use UTC timezone so the hour we pass in IS the local hour
        var utcTime = new DateTime(2026, 2, 24, hour, 0, 0, DateTimeKind.Utc);

        var result = BriefingService.BuildGreeting("Test User", utcTime, "Etc/UTC");

        Assert.StartsWith(expectedPrefix, result);
    }
}
