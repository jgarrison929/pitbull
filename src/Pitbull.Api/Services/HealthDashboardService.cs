using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;

namespace Pitbull.Api.Services;

public interface IHealthDashboardService
{
    Task<AdminHealthDashboardDto> GetAsync(CancellationToken cancellationToken = default);
}

public sealed class HealthDashboardService(
    IRequestMetricsStore metricsStore,
    IErrorLogStore errorLogStore,
    PitbullDbContext db) : IHealthDashboardService
{
    public async Task<AdminHealthDashboardDto> GetAsync(CancellationToken cancellationToken = default)
    {
        var metrics = metricsStore.GetSnapshot();
        var now = DateTime.UtcNow;
        var uptime = now - metrics.StartedAtUtc;
        var activeConnections = await GetActiveConnectionsAsync(cancellationToken);
        var memoryInfo = GC.GetGCMemoryInfo();

        return new AdminHealthDashboardDto(
            Uptime: FormatUptime(uptime),
            UptimeSeconds: (long)uptime.TotalSeconds,
            TotalRequestsToday: metrics.RequestsToday,
            ResponseTimes: new ResponseTimesDto(
                AverageMs: Math.Round(metrics.AverageMs, 2),
                P50Ms: Math.Round(metrics.P50Ms, 2),
                P95Ms: Math.Round(metrics.P95Ms, 2),
                P99Ms: Math.Round(metrics.P99Ms, 2),
                RecentDurationsMs: metrics.RecentDurationsMs.Select(x => Math.Round(x, 2)).ToArray()),
            ActiveDatabaseConnections: activeConnections,
            RecentErrors: errorLogStore.GetRecent(10).Select(x => new RecentErrorDto(
                TimestampUtc: x.TimestampUtc,
                Level: x.Level,
                Message: x.Message,
                Exception: x.Exception,
                TraceId: x.TraceId,
                RequestPath: x.RequestPath)).ToArray(),
            Memory: new MemoryUsageDto(
                ManagedBytes: GC.GetTotalMemory(forceFullCollection: false),
                TotalAvailableBytes: memoryInfo.TotalAvailableMemoryBytes,
                HeapBytes: memoryInfo.HeapSizeBytes,
                FragmentedBytes: memoryInfo.FragmentedBytes,
                Gen0Collections: GC.CollectionCount(0),
                Gen1Collections: GC.CollectionCount(1),
                Gen2Collections: GC.CollectionCount(2)));
    }

    private async Task<int?> GetActiveConnectionsAsync(CancellationToken cancellationToken)
    {
        if (!db.Database.IsRelational())
            return null;

        var opened = false;
        try
        {
            await db.Database.OpenConnectionAsync(cancellationToken);
            opened = true;
            await using var command = db.Database.GetDbConnection().CreateCommand();
            command.CommandText =
                "SELECT COUNT(*)::int FROM pg_stat_activity WHERE datname = current_database();";
            var scalar = await command.ExecuteScalarAsync(cancellationToken);
            return scalar is int count ? count : Convert.ToInt32(scalar);
        }
        catch
        {
            return null;
        }
        finally
        {
            if (opened)
                await db.Database.CloseConnectionAsync();
        }
    }

    private static string FormatUptime(TimeSpan uptime)
        => $"{(int)uptime.TotalDays}d {uptime.Hours}h {uptime.Minutes}m";
}

public sealed record AdminHealthDashboardDto(
    string Uptime,
    long UptimeSeconds,
    long TotalRequestsToday,
    ResponseTimesDto ResponseTimes,
    int? ActiveDatabaseConnections,
    IReadOnlyList<RecentErrorDto> RecentErrors,
    MemoryUsageDto Memory);

public sealed record ResponseTimesDto(
    double AverageMs,
    double P50Ms,
    double P95Ms,
    double P99Ms,
    IReadOnlyList<double> RecentDurationsMs);

public sealed record RecentErrorDto(
    DateTime TimestampUtc,
    string Level,
    string Message,
    string? Exception,
    string? TraceId,
    string? RequestPath);

public sealed record MemoryUsageDto(
    long ManagedBytes,
    long TotalAvailableBytes,
    long HeapBytes,
    long FragmentedBytes,
    int Gen0Collections,
    int Gen1Collections,
    int Gen2Collections);
