using FluentAssertions;
using Pitbull.Api.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Services;

public class HealthDashboardServiceTests
{
    private sealed class StubMetricsStore(RequestMetricsSnapshot snapshot) : IRequestMetricsStore
    {
        public void RecordRequest(TimeSpan duration, int statusCode) { }
        public RequestMetricsSnapshot GetSnapshot() => snapshot;
    }

    [Fact]
    public async Task GetAsync_ReturnsTelemetryAndErrors()
    {
        using var db = TestDbContextFactory.Create();
        var metrics = new StubMetricsStore(new RequestMetricsSnapshot(
            StartedAtUtc: DateTime.UtcNow.AddHours(-2),
            RequestsToday: 42,
            AverageMs: 150,
            P50Ms: 120,
            P95Ms: 300,
            P99Ms: 450,
            RecentDurationsMs: [100, 120, 200]));

        var errors = new InMemoryErrorLogStore();
        errors.Add(new RecentErrorEntry(
            TimestampUtc: DateTime.UtcNow,
            Level: "Error",
            Message: "Unhandled exception",
            Exception: "boom",
            TraceId: "abc123",
            RequestPath: "/api/foo"));

        var service = new HealthDashboardService(metrics, errors, db);

        var result = await service.GetAsync();

        result.TotalRequestsToday.Should().Be(42);
        result.ResponseTimes.P95Ms.Should().Be(300);
        result.RecentErrors.Should().HaveCount(1);
        result.Memory.ManagedBytes.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task GetAsync_WhenNoErrors_ReturnsEmptyRecentErrors()
    {
        using var db = TestDbContextFactory.Create();
        var metrics = new StubMetricsStore(new RequestMetricsSnapshot(
            StartedAtUtc: DateTime.UtcNow.AddMinutes(-10),
            RequestsToday: 1,
            AverageMs: 20,
            P50Ms: 20,
            P95Ms: 20,
            P99Ms: 20,
            RecentDurationsMs: [20]));
        var errors = new InMemoryErrorLogStore();

        var service = new HealthDashboardService(metrics, errors, db);
        var result = await service.GetAsync();

        result.RecentErrors.Should().BeEmpty();
        result.UptimeSeconds.Should().BeGreaterThan(0);
    }
}
