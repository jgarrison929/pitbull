using FluentAssertions;
using Pitbull.Api.Services;

namespace Pitbull.Tests.Unit.Services;

public class RequestMetricsStoreTests
{
    [Fact]
    public void RecordRequest_IncrementsRequestCount()
    {
        var store = new RequestMetricsStore();

        store.RecordRequest(TimeSpan.FromMilliseconds(100), 200);
        store.RecordRequest(TimeSpan.FromMilliseconds(250), 200);

        var snapshot = store.GetSnapshot();
        snapshot.RequestsToday.Should().Be(2);
    }

    [Fact]
    public void RecordRequest_ComputesAverageAndPercentiles()
    {
        var store = new RequestMetricsStore();
        store.RecordRequest(TimeSpan.FromMilliseconds(100), 200);
        store.RecordRequest(TimeSpan.FromMilliseconds(200), 200);
        store.RecordRequest(TimeSpan.FromMilliseconds(300), 200);
        store.RecordRequest(TimeSpan.FromMilliseconds(400), 200);

        var snapshot = store.GetSnapshot();
        snapshot.AverageMs.Should().BeApproximately(250, 0.01);
        snapshot.P50Ms.Should().BeApproximately(250, 0.01);
        snapshot.P95Ms.Should().BeGreaterThan(350);
        snapshot.P99Ms.Should().BeGreaterThan(snapshot.P95Ms - 5);
    }

    [Fact]
    public void RecordRequest_RingBufferKeepsOnlyLastThousand()
    {
        var store = new RequestMetricsStore();

        for (var i = 0; i < 1200; i++)
            store.RecordRequest(TimeSpan.FromMilliseconds(i + 1), 200);

        var snapshot = store.GetSnapshot();
        snapshot.RecentDurationsMs.Count.Should().Be(60);
        snapshot.P50Ms.Should().BeGreaterThan(600); // older fast requests were evicted
    }
}
