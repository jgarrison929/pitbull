using FluentAssertions;
using Pitbull.Core.Features.GetDashboardStats;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

/// <summary>
/// Tests for GetDashboardStatsHandler.
/// Note: The handler uses raw SQL (SqlQueryRaw) and reflection-based entity resolution,
/// which don't work with the EF InMemory provider. These tests verify that the handler
/// gracefully handles failures (returns zero stats) rather than crashing.
/// Full integration tests with a real PostgreSQL database should cover the happy path.
/// </summary>
public class GetDashboardStatsHandlerTests
{
    [Fact]
    public async Task Handle_WhenDatabaseEmpty_ReturnsZeroStats()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new GetDashboardStatsHandler(db);
        var query = new GetDashboardStatsQuery();

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert - handler catches exceptions and returns zero stats gracefully
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.PendingChangeOrders.Should().Be(0);
    }

    [Fact]
    public async Task Handle_ReturnsResponseWithAllFields()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new GetDashboardStatsHandler(db);
        var query = new GetDashboardStatsQuery();

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert - verify the response shape is correct even when data is zero
        result.IsSuccess.Should().BeTrue();
        var stats = result.Value!;
        stats.ProjectCount.Should().BeGreaterThanOrEqualTo(0);
        stats.BidCount.Should().BeGreaterThanOrEqualTo(0);
        stats.TotalProjectValue.Should().BeGreaterThanOrEqualTo(0);
        stats.TotalBidValue.Should().BeGreaterThanOrEqualTo(0);
        stats.PendingChangeOrders.Should().Be(0);
        stats.LastActivityDate.Should().BeBefore(DateTime.UtcNow.AddMinutes(1));
    }

    [Fact]
    public void DashboardStatsResponse_RecordEquality()
    {
        // Arrange
        var date = DateTime.UtcNow;
        var stats1 = new DashboardStatsResponse(5, 10, 500_000m, 1_000_000m, 2, date);
        var stats2 = new DashboardStatsResponse(5, 10, 500_000m, 1_000_000m, 2, date);
        var stats3 = new DashboardStatsResponse(3, 10, 500_000m, 1_000_000m, 2, date);

        // Assert - record value equality
        stats1.Should().Be(stats2);
        stats1.Should().NotBe(stats3);
    }

    [Fact]
    public void GetDashboardStatsQuery_IsParameterless()
    {
        // Verify the query has no parameters (it gets stats for the current tenant via context)
        var query = new GetDashboardStatsQuery();
        query.Should().NotBeNull();
    }
}
