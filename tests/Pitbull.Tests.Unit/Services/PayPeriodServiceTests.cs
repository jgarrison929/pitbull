using FluentAssertions;
using Moq;
using Pitbull.Core.MultiTenancy;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Entities;
using Pitbull.TimeTracking.Services;

namespace Pitbull.Tests.Unit.Services;

public class PayPeriodServiceTests
{
    #region Weekly Period Tests

    [Theory]
    [InlineData("2026-02-11", DayOfWeek.Sunday, "2026-02-08", "2026-02-14")] // Wednesday
    [InlineData("2026-02-08", DayOfWeek.Sunday, "2026-02-08", "2026-02-14")] // Sunday (start)
    [InlineData("2026-02-14", DayOfWeek.Sunday, "2026-02-08", "2026-02-14")] // Saturday (end)
    [InlineData("2026-02-11", DayOfWeek.Monday, "2026-02-09", "2026-02-15")] // Wednesday, Mon start
    [InlineData("2026-02-09", DayOfWeek.Monday, "2026-02-09", "2026-02-15")] // Monday (start)
    [InlineData("2026-02-15", DayOfWeek.Monday, "2026-02-09", "2026-02-15")] // Sunday (end)
    public void CalculatePeriodBoundaries_Weekly_CalculatesCorrectly(
        string dateStr, DayOfWeek weekStart, string expectedStartStr, string expectedEndStr)
    {
        // Arrange
        var date = DateOnly.Parse(dateStr);
        var config = CreateConfig(PayPeriodType.Weekly, weekStart);
        var service = CreateServiceWithoutDb();

        // Act
        var (startDate, endDate) = service.CalculatePeriodBoundaries(date, config);

        // Assert
        startDate.Should().Be(DateOnly.Parse(expectedStartStr));
        endDate.Should().Be(DateOnly.Parse(expectedEndStr));
        (endDate.DayNumber - startDate.DayNumber + 1).Should().Be(7); // Always 7 days
    }

    #endregion

    #region Bi-Weekly Period Tests

    [Theory]
    [InlineData("2026-02-11", DayOfWeek.Sunday, "2026-02-01", "2026-02-14")] // Mid bi-week
    [InlineData("2026-02-01", DayOfWeek.Sunday, "2026-02-01", "2026-02-14")] // Start of bi-week
    [InlineData("2026-02-14", DayOfWeek.Sunday, "2026-02-01", "2026-02-14")] // End of bi-week
    [InlineData("2026-02-15", DayOfWeek.Sunday, "2026-02-15", "2026-02-28")] // Start of next bi-week
    public void CalculatePeriodBoundaries_BiWeekly_CalculatesCorrectly(
        string dateStr, DayOfWeek weekStart, string expectedStartStr, string expectedEndStr)
    {
        // Arrange
        var date = DateOnly.Parse(dateStr);
        var config = CreateConfig(PayPeriodType.BiWeekly, weekStart);
        // Set reference date to Feb 1, 2026 (a Sunday)
        config.BiWeeklyReferenceDate = new DateOnly(2026, 2, 1);
        var service = CreateServiceWithoutDb();

        // Act
        var (startDate, endDate) = service.CalculatePeriodBoundaries(date, config);

        // Assert
        startDate.Should().Be(DateOnly.Parse(expectedStartStr));
        endDate.Should().Be(DateOnly.Parse(expectedEndStr));
        (endDate.DayNumber - startDate.DayNumber + 1).Should().Be(14); // Always 14 days
    }

    #endregion

    #region Semi-Monthly Period Tests

    [Theory]
    [InlineData("2026-02-05", 1, 16, "2026-02-01", "2026-02-15")] // First half
    [InlineData("2026-02-01", 1, 16, "2026-02-01", "2026-02-15")] // First day
    [InlineData("2026-02-15", 1, 16, "2026-02-01", "2026-02-15")] // Last day first half
    [InlineData("2026-02-16", 1, 16, "2026-02-16", "2026-02-28")] // Second half
    [InlineData("2026-02-28", 1, 16, "2026-02-16", "2026-02-28")] // Last day of month
    [InlineData("2026-01-31", 1, 16, "2026-01-16", "2026-01-31")] // Jan 31 (31-day month)
    public void CalculatePeriodBoundaries_SemiMonthly_CalculatesCorrectly(
        string dateStr, int firstDay, int secondDay, string expectedStartStr, string expectedEndStr)
    {
        // Arrange
        var date = DateOnly.Parse(dateStr);
        var config = CreateConfig(PayPeriodType.SemiMonthly, DayOfWeek.Sunday, firstDay, secondDay);
        var service = CreateServiceWithoutDb();

        // Act
        var (startDate, endDate) = service.CalculatePeriodBoundaries(date, config);

        // Assert
        startDate.Should().Be(DateOnly.Parse(expectedStartStr));
        endDate.Should().Be(DateOnly.Parse(expectedEndStr));
    }

    [Fact]
    public void CalculatePeriodBoundaries_SemiMonthly_HandlesLeapYear()
    {
        // Arrange - Feb 2028 is a leap year
        var date = DateOnly.Parse("2028-02-20");
        var config = CreateConfig(PayPeriodType.SemiMonthly, DayOfWeek.Sunday, 1, 16);
        var service = CreateServiceWithoutDb();

        // Act
        var (startDate, endDate) = service.CalculatePeriodBoundaries(date, config);

        // Assert
        startDate.Should().Be(DateOnly.Parse("2028-02-16"));
        endDate.Should().Be(DateOnly.Parse("2028-02-29")); // 29 days in leap year
    }

    #endregion

    #region Monthly Period Tests

    [Theory]
    [InlineData("2026-02-11", "2026-02-01", "2026-02-28")] // February
    [InlineData("2026-01-15", "2026-01-01", "2026-01-31")] // January (31 days)
    [InlineData("2026-04-30", "2026-04-01", "2026-04-30")] // April (30 days)
    [InlineData("2028-02-15", "2028-02-01", "2028-02-29")] // Leap year February
    public void CalculatePeriodBoundaries_Monthly_CalculatesCorrectly(
        string dateStr, string expectedStartStr, string expectedEndStr)
    {
        // Arrange
        var date = DateOnly.Parse(dateStr);
        var config = CreateConfig(PayPeriodType.Monthly);
        var service = CreateServiceWithoutDb();

        // Act
        var (startDate, endDate) = service.CalculatePeriodBoundaries(date, config);

        // Assert
        startDate.Should().Be(DateOnly.Parse(expectedStartStr));
        endDate.Should().Be(DateOnly.Parse(expectedEndStr));
    }

    #endregion

    #region Generate Future Periods Tests

    [Fact]
    public void GenerateFuturePeriods_Weekly_GeneratesCorrectCount()
    {
        // Arrange
        var config = CreateConfig(PayPeriodType.Weekly, DayOfWeek.Sunday);
        var fromDate = DateOnly.Parse("2026-02-11"); // Wednesday
        var service = CreateServiceWithoutDb();

        // Act
        var periods = service.GenerateFuturePeriods(config, fromDate, periodsAhead: 4);

        // Assert
        periods.Should().HaveCount(5); // Current + 4 future

        // Verify first period (contains fromDate)
        periods[0].StartDate.Should().Be(DateOnly.Parse("2026-02-08")); // Sunday
        periods[0].EndDate.Should().Be(DateOnly.Parse("2026-02-14")); // Saturday

        // Verify periods are consecutive
        for (int i = 1; i < periods.Count; i++)
        {
            periods[i].StartDate.Should().Be(periods[i - 1].EndDate.AddDays(1));
        }
    }

    [Fact]
    public void GenerateFuturePeriods_Monthly_GeneratesCorrectPeriods()
    {
        // Arrange
        var config = CreateConfig(PayPeriodType.Monthly);
        var fromDate = DateOnly.Parse("2026-02-11");
        var service = CreateServiceWithoutDb();

        // Act
        var periods = service.GenerateFuturePeriods(config, fromDate, periodsAhead: 3);

        // Assert
        periods.Should().HaveCount(4);

        // Feb 2026
        periods[0].StartDate.Should().Be(DateOnly.Parse("2026-02-01"));
        periods[0].EndDate.Should().Be(DateOnly.Parse("2026-02-28"));

        // Mar 2026
        periods[1].StartDate.Should().Be(DateOnly.Parse("2026-03-01"));
        periods[1].EndDate.Should().Be(DateOnly.Parse("2026-03-31"));

        // Apr 2026
        periods[2].StartDate.Should().Be(DateOnly.Parse("2026-04-01"));
        periods[2].EndDate.Should().Be(DateOnly.Parse("2026-04-30"));

        // May 2026
        periods[3].StartDate.Should().Be(DateOnly.Parse("2026-05-01"));
        periods[3].EndDate.Should().Be(DateOnly.Parse("2026-05-31"));
    }

    [Fact]
    public void GenerateFuturePeriods_BiWeekly_GeneratesConsecutivePeriods()
    {
        // Arrange
        var config = CreateConfig(PayPeriodType.BiWeekly, DayOfWeek.Sunday);
        config.BiWeeklyReferenceDate = new DateOnly(2026, 1, 4); // A Sunday
        var fromDate = DateOnly.Parse("2026-02-01");
        var service = CreateServiceWithoutDb();

        // Act
        var periods = service.GenerateFuturePeriods(config, fromDate, periodsAhead: 2);

        // Assert
        periods.Should().HaveCount(3);

        // Verify all periods are 14 days
        foreach (var period in periods)
        {
            (period.EndDate.DayNumber - period.StartDate.DayNumber + 1).Should().Be(14);
        }

        // Verify consecutive
        for (int i = 1; i < periods.Count; i++)
        {
            periods[i].StartDate.Should().Be(periods[i - 1].EndDate.AddDays(1));
        }
    }

    #endregion

    #region PayPeriod Entity Tests

    [Fact]
    public void PayPeriod_ContainsDate_ReturnsTrueForDateInRange()
    {
        // Arrange
        var period = new PayPeriod
        {
            StartDate = new DateOnly(2026, 2, 1),
            EndDate = new DateOnly(2026, 2, 14)
        };

        // Act & Assert
        period.ContainsDate(new DateOnly(2026, 2, 1)).Should().BeTrue();  // Start
        period.ContainsDate(new DateOnly(2026, 2, 7)).Should().BeTrue();  // Middle
        period.ContainsDate(new DateOnly(2026, 2, 14)).Should().BeTrue(); // End
        period.ContainsDate(new DateOnly(2026, 1, 31)).Should().BeFalse(); // Before
        period.ContainsDate(new DateOnly(2026, 2, 15)).Should().BeFalse(); // After
    }

    [Theory]
    [InlineData(PayPeriodStatus.Open, false)]
    [InlineData(PayPeriodStatus.Locked, true)]
    [InlineData(PayPeriodStatus.Closed, true)]
    public void PayPeriod_IsLocked_ReturnsCorrectValue(PayPeriodStatus status, bool expectedLocked)
    {
        // Arrange
        var period = new PayPeriod { Status = status };

        // Act & Assert
        period.IsLocked.Should().Be(expectedLocked);
    }

    #endregion

    #region Helper Methods

    private static PayPeriodConfiguration CreateConfig(
        PayPeriodType type,
        DayOfWeek weekStart = DayOfWeek.Sunday,
        int semiMonthlyFirstDay = 1,
        int semiMonthlySecondDay = 16)
    {
        return new PayPeriodConfiguration
        {
            Type = type,
            WeekStartDay = weekStart,
            SemiMonthlyFirstDay = semiMonthlyFirstDay,
            SemiMonthlySecondDay = semiMonthlySecondDay,
            AutoLockEnabled = false,
            AutoLockDaysAfterEnd = 3,
            PeriodsToGenerateAhead = 4,
            EnforcementEnabled = true
        };
    }

    /// <summary>
    /// Creates a PayPeriodService without database context for testing calculation methods
    /// </summary>
    private static PayPeriodService CreateServiceWithoutDb()
    {
        // PayPeriodService uses db and tenantContext only for async methods, not for calculations
        return new PayPeriodService(null!, Mock.Of<ITenantContext>());
    }

    #endregion
}
