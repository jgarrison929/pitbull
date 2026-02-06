using FluentAssertions;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Services;

namespace Pitbull.Tests.Unit.Services;

public class LaborCostCalculatorTests
{
    private readonly LaborCostCalculator _calculator = new();

    private static Employee CreateEmployee(decimal hourlyRate = 25m) => new()
    {
        Id = Guid.NewGuid(),
        FirstName = "John",
        LastName = "Doe",
        EmployeeNumber = "E001",
        BaseHourlyRate = hourlyRate,
        Classification = EmployeeClassification.Hourly,
        IsActive = true
    };

    private static TimeEntry CreateTimeEntry(
        decimal regularHours = 8m,
        decimal overtimeHours = 0m,
        decimal doubletimeHours = 0m,
        Employee? employee = null) => new()
    {
        Id = Guid.NewGuid(),
        Date = DateOnly.FromDateTime(DateTime.Today),
        EmployeeId = employee?.Id ?? Guid.NewGuid(),
        ProjectId = Guid.NewGuid(),
        CostCodeId = Guid.NewGuid(),
        RegularHours = regularHours,
        OvertimeHours = overtimeHours,
        DoubletimeHours = doubletimeHours,
        Status = TimeEntryStatus.Approved,
        Employee = employee!
    };

    [Fact]
    public void CalculateCost_RegularHoursOnly_CalculatesCorrectly()
    {
        // Arrange
        var employee = CreateEmployee(hourlyRate: 30m);
        var entry = CreateTimeEntry(regularHours: 8m, employee: employee);

        // Act
        var result = _calculator.CalculateCost(entry, employee);

        // Assert
        // 8 hours × $30 = $240 base
        result.HoursBreakdown.RegularHours.Should().Be(8m);
        result.HoursBreakdown.RegularCost.Should().Be(240m);
        result.BaseWageCost.Should().Be(240m);

        // Default burden = 35%: $240 × 0.35 = $84
        result.BurdenCost.Should().Be(84m);
        result.BurdenRateApplied.Should().Be(0.35m);

        // Total = $240 + $84 = $324
        result.TotalCost.Should().Be(324m);
    }

    [Fact]
    public void CalculateCost_WithOvertime_AppliesMultiplier()
    {
        // Arrange
        var employee = CreateEmployee(hourlyRate: 20m);
        var entry = CreateTimeEntry(regularHours: 8m, overtimeHours: 2m, employee: employee);

        // Act
        var result = _calculator.CalculateCost(entry, employee);

        // Assert
        // Regular: 8 × $20 = $160
        result.HoursBreakdown.RegularCost.Should().Be(160m);

        // Overtime: 2 × $20 × 1.5 = $60
        result.HoursBreakdown.OvertimeHours.Should().Be(2m);
        result.HoursBreakdown.OvertimeCost.Should().Be(60m);

        // Base wage = $160 + $60 = $220
        result.BaseWageCost.Should().Be(220m);
    }

    [Fact]
    public void CalculateCost_WithDoubletime_AppliesMultiplier()
    {
        // Arrange
        var employee = CreateEmployee(hourlyRate: 25m);
        var entry = CreateTimeEntry(regularHours: 0m, doubletimeHours: 8m, employee: employee);

        // Act
        var result = _calculator.CalculateCost(entry, employee);

        // Assert
        // Doubletime: 8 × $25 × 2.0 = $400
        result.HoursBreakdown.DoubletimeHours.Should().Be(8m);
        result.HoursBreakdown.DoubletimeCost.Should().Be(400m);
        result.BaseWageCost.Should().Be(400m);
    }

    [Fact]
    public void CalculateCost_MixedHours_CalculatesAllTypes()
    {
        // Arrange
        var employee = CreateEmployee(hourlyRate: 40m);
        var entry = CreateTimeEntry(
            regularHours: 8m,
            overtimeHours: 3m,
            doubletimeHours: 2m,
            employee: employee);

        // Act
        var result = _calculator.CalculateCost(entry, employee);

        // Assert
        // Regular: 8 × $40 = $320
        result.HoursBreakdown.RegularCost.Should().Be(320m);

        // Overtime: 3 × $40 × 1.5 = $180
        result.HoursBreakdown.OvertimeCost.Should().Be(180m);

        // Doubletime: 2 × $40 × 2.0 = $160
        result.HoursBreakdown.DoubletimeCost.Should().Be(160m);

        // Base wage = $320 + $180 + $160 = $660
        result.BaseWageCost.Should().Be(660m);

        // Burden = $660 × 0.35 = $231
        result.BurdenCost.Should().Be(231m);

        // Total = $660 + $231 = $891
        result.TotalCost.Should().Be(891m);
    }

    [Fact]
    public void CalculateCost_CustomBurdenRate_OverridesDefault()
    {
        // Arrange
        var employee = CreateEmployee(hourlyRate: 50m);
        var entry = CreateTimeEntry(regularHours: 8m, employee: employee);
        var customBurden = 0.40m; // 40%

        // Act
        var result = _calculator.CalculateCost(entry, employee, burdenRate: customBurden);

        // Assert
        // Base: 8 × $50 = $400
        result.BaseWageCost.Should().Be(400m);

        // Burden at 40%: $400 × 0.40 = $160
        result.BurdenCost.Should().Be(160m);
        result.BurdenRateApplied.Should().Be(0.40m);

        // Total = $400 + $160 = $560
        result.TotalCost.Should().Be(560m);
    }

    [Fact]
    public void CalculateCost_ZeroHours_ReturnsZeroCost()
    {
        // Arrange
        var employee = CreateEmployee(hourlyRate: 30m);
        var entry = CreateTimeEntry(regularHours: 0m, overtimeHours: 0m, doubletimeHours: 0m, employee: employee);

        // Act
        var result = _calculator.CalculateCost(entry, employee);

        // Assert
        result.BaseWageCost.Should().Be(0m);
        result.BurdenCost.Should().Be(0m);
        result.TotalCost.Should().Be(0m);
    }

    [Fact]
    public void CalculateCost_NullTimeEntry_ThrowsArgumentNullException()
    {
        // Arrange
        var employee = CreateEmployee();

        // Act & Assert
        var act = () => _calculator.CalculateCost(null!, employee);
        act.Should().Throw<ArgumentNullException>()
            .WithParameterName("timeEntry");
    }

    [Fact]
    public void CalculateCost_NullEmployee_ThrowsArgumentNullException()
    {
        // Arrange
        var entry = CreateTimeEntry();

        // Act & Assert
        var act = () => _calculator.CalculateCost(entry, null!);
        act.Should().Throw<ArgumentNullException>()
            .WithParameterName("employee");
    }

    [Fact]
    public void CalculateCost_RoundsToTwoCents()
    {
        // Arrange - rate that produces fractional cents
        var employee = CreateEmployee(hourlyRate: 33.33m);
        var entry = CreateTimeEntry(regularHours: 1m, employee: employee);

        // Act
        var result = _calculator.CalculateCost(entry, employee);

        // Assert - should round to 2 decimal places
        result.BaseWageCost.Should().Be(33.33m);
        // Burden: $33.33 × 0.35 = $11.6655 → rounds to $11.67
        result.BurdenCost.Should().Be(11.67m);
    }

    // CalculateTotalCost tests

    [Fact]
    public void CalculateTotalCost_EmptyList_ReturnsZero()
    {
        // Act
        var result = _calculator.CalculateTotalCost([]);

        // Assert
        result.BaseWageCost.Should().Be(0m);
        result.BurdenCost.Should().Be(0m);
        result.TotalCost.Should().Be(0m);
        result.HoursBreakdown.RegularHours.Should().Be(0m);
    }

    [Fact]
    public void CalculateTotalCost_MultipleEntries_AggregatesCorrectly()
    {
        // Arrange
        var employee1 = CreateEmployee(hourlyRate: 30m);
        var employee2 = CreateEmployee(hourlyRate: 40m);

        var entries = new[]
        {
            CreateTimeEntry(regularHours: 8m, employee: employee1),
            CreateTimeEntry(regularHours: 8m, overtimeHours: 2m, employee: employee2)
        };

        // Act
        var result = _calculator.CalculateTotalCost(entries);

        // Assert
        // Entry 1: 8 × $30 = $240
        // Entry 2: 8 × $40 = $320 regular + 2 × $40 × 1.5 = $120 OT = $440
        // Total base = $240 + $440 = $680
        result.BaseWageCost.Should().Be(680m);

        // Total hours
        result.HoursBreakdown.RegularHours.Should().Be(16m);
        result.HoursBreakdown.OvertimeHours.Should().Be(2m);

        // Burden = $680 × 0.35 = $238
        result.BurdenCost.Should().Be(238m);
    }

    [Fact]
    public void CalculateTotalCost_MissingEmployee_ThrowsInvalidOperation()
    {
        // Arrange - entry without Employee loaded
        var entry = new TimeEntry
        {
            Id = Guid.NewGuid(),
            Date = DateOnly.FromDateTime(DateTime.Today),
            EmployeeId = Guid.NewGuid(),
            ProjectId = Guid.NewGuid(),
            CostCodeId = Guid.NewGuid(),
            RegularHours = 8m,
            Employee = null! // Navigation not loaded
        };

        // Act & Assert
        var act = () => _calculator.CalculateTotalCost([entry]);
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Employee navigation property*");
    }

    [Fact]
    public void CalculateTotalCost_NullEntries_ThrowsArgumentNullException()
    {
        // Act & Assert
        var act = () => _calculator.CalculateTotalCost(null!);
        act.Should().Throw<ArgumentNullException>()
            .WithParameterName("entries");
    }

    [Theory]
    [InlineData(0.25, 200, 50)]    // 25% burden
    [InlineData(0.35, 200, 70)]    // 35% burden (default)
    [InlineData(0.45, 200, 90)]    // 45% burden (high)
    public void CalculateTotalCost_CustomBurdenRate_AppliedToAll(
        decimal burdenRate, decimal expectedBase, decimal expectedBurden)
    {
        // Arrange
        var employee = CreateEmployee(hourlyRate: 25m);
        var entry = CreateTimeEntry(regularHours: 8m, employee: employee);

        // Act
        var result = _calculator.CalculateTotalCost([entry], burdenRate);

        // Assert
        result.BaseWageCost.Should().Be(expectedBase);
        result.BurdenCost.Should().Be(expectedBurden);
        result.BurdenRateApplied.Should().Be(burdenRate);
    }
}
