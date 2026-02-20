namespace Pitbull.Api.Services;

public interface IErrorLogStore
{
    void Add(RecentErrorEntry entry);
    IReadOnlyList<RecentErrorEntry> GetRecent(int maxCount);
}

public sealed class InMemoryErrorLogStore : IErrorLogStore
{
    private const int Capacity = 200;
    private readonly object _gate = new();
    private readonly Queue<RecentErrorEntry> _entries = new();

    public void Add(RecentErrorEntry entry)
    {
        lock (_gate)
        {
            _entries.Enqueue(entry);
            while (_entries.Count > Capacity)
                _entries.Dequeue();
        }
    }

    public IReadOnlyList<RecentErrorEntry> GetRecent(int maxCount)
    {
        lock (_gate)
        {
            return _entries
                .OrderByDescending(x => x.TimestampUtc)
                .Take(Math.Max(0, maxCount))
                .ToList();
        }
    }
}

public sealed record RecentErrorEntry(
    DateTime TimestampUtc,
    string Level,
    string Message,
    string? Exception,
    string? TraceId,
    string? RequestPath);
