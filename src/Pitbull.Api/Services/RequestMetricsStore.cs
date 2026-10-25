namespace Pitbull.Api.Services;

public interface IRequestMetricsStore
{
    void RecordRequest(TimeSpan duration, int statusCode);
    RequestMetricsSnapshot GetSnapshot();
}

public sealed class RequestMetricsStore : IRequestMetricsStore
{
    private const int Capacity = 1000;
    private readonly object _gate = new();
    private readonly double[] _durationsMs = new double[Capacity];
    private int _writeIndex;
    private int _count;
    private long _requestsToday;
    private DateOnly _currentDayUtc = DateOnly.FromDateTime(DateTime.UtcNow);
    private readonly DateTime _startedAtUtc = DateTime.UtcNow;

    public void RecordRequest(TimeSpan duration, int statusCode)
    {
        var nowDay = DateOnly.FromDateTime(DateTime.UtcNow);
        var durationMs = Math.Max(0, duration.TotalMilliseconds);

        lock (_gate)
        {
            if (_currentDayUtc != nowDay)
            {
                _currentDayUtc = nowDay;
                _requestsToday = 0;
            }

            _requestsToday++;
            _durationsMs[_writeIndex] = durationMs;
            _writeIndex = (_writeIndex + 1) % Capacity;

            if (_count < Capacity)
                _count++;
        }
    }

    public RequestMetricsSnapshot GetSnapshot()
    {
        lock (_gate)
        {
            var recent = new double[_count];
            for (var i = 0; i < _count; i++)
            {
                var idx = (_writeIndex - _count + i + Capacity) % Capacity;
                recent[i] = _durationsMs[idx];
            }

            var sorted = recent.ToArray();
            Array.Sort(sorted);

            var average = recent.Length == 0 ? 0d : recent.Average();

            return new RequestMetricsSnapshot(
                StartedAtUtc: _startedAtUtc,
                RequestsToday: _requestsToday,
                AverageMs: average,
                P50Ms: Percentile(sorted, 50),
                P95Ms: Percentile(sorted, 95),
                P99Ms: Percentile(sorted, 99),
                RecentDurationsMs: recent.TakeLast(60).ToArray());
        }
    }

    private static double Percentile(IReadOnlyList<double> sorted, int percentile)
    {
        if (sorted.Count == 0)
            return 0d;

        var position = (percentile / 100d) * (sorted.Count - 1);
        var lower = (int)Math.Floor(position);
        var upper = (int)Math.Ceiling(position);
        if (lower == upper)
            return sorted[lower];

        var weight = position - lower;
        return sorted[lower] + ((sorted[upper] - sorted[lower]) * weight);
    }
}

public sealed record RequestMetricsSnapshot(
    DateTime StartedAtUtc,
    long RequestsToday,
    double AverageMs,
    double P50Ms,
    double P95Ms,
    double P99Ms,
    IReadOnlyList<double> RecentDurationsMs);
