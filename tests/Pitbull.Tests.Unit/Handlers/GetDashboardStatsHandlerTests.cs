using FluentAssertions;
using Pitbull.Core.Features.Dashboard;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

/// <summary>
/// Tests for DashboardService.GetStatsAsync.
/// Note: The service uses raw SQL (SqlQueryRaw) and reflection-based entity resolution,
/// which don't work with the EF InMemory provider. These tests verify that the service
/// gracefully handles failures (returns zero stats) rather than crashing.
/// Full integration tests with a real PostgreSQL database should cover the happy path.
/// </summary>
public class DashboardServiceStatsTests
{
    [Fact]
    public async Task GetStatsAsync_WhenDatabaseEmpty_ReturnsZeroStats()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = new DashboardService(db);

        // Act
        var result = await service.GetStatsAsync();

        // Assert - service catches exceptions and returns zero stats gracefully
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.PendingChangeOrders.Should().Be(0);
    }

    [Fact]
    public async Task GetStatsAsync_ReturnsResponseWithAllFields()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = new DashboardService(db);

        // Act
        var result = await service.GetStatsAsync();

        // Assert - verify the response shape is correct even when data is zero
        result.IsSuccess.Should().BeTrue();
        var stats = result.Value!;
        stats.ProjectCount.Should().BeGreaterThanOrEqualTo(0);
        stats.BidCount.Should().BeGreaterThanOrEqualTo(0);
        stats.TotalProjectValue.Should().BeGreaterThanOrEqualTo(0);
        stats.TotalBidValue.Should().BeGreaterThanOrEqualTo(0);
        stats.PendingChangeOrders.Should().Be(0);
        stats.EmployeeCount.Should().BeGreaterThanOrEqualTo(0);
        stats.PendingTimeApprovals.Should().BeGreaterThanOrEqualTo(0);
        stats.RecentActivity.Should().NotBeNull();
        stats.LastActivityDate.Should().BeBefore(DateTime.UtcNow.AddMinutes(1));
    }

    [Fact]
    public void DashboardStatsResponse_RecordEquality()
    {
        // Arrange
        var date = DateTime.UtcNow;
        var activity = new List<RecentActivityItem>();
        var stats1 = new DashboardStatsResponse(5, 10, 500_000m, 1_000_000m, 2, date, 15, 3, activity);
        var stats2 = new DashboardStatsResponse(5, 10, 500_000m, 1_000_000m, 2, date, 15, 3, activity);
        var stats3 = new DashboardStatsResponse(3, 10, 500_000m, 1_000_000m, 2, date, 15, 3, activity);

        // Assert - record value equality
        stats1.Should().Be(stats2);
        stats1.Should().NotBe(stats3);
    }
}
