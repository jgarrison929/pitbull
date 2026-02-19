using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.SystemAdmin.Domain;

namespace Pitbull.SystemAdmin.Services;

public class SystemHealthService(PitbullDbContext db) : ISystemHealthService
{
    public async Task<Result<SystemHealthDto>> GetHealthAsync(CancellationToken ct = default)
    {
        var dbHealth = await CheckDatabaseHealthAsync(ct);
        var stats = await GetStatsAsync(ct);

        var status = dbHealth.Connected ? "Healthy" : "Degraded";

        return Result.Success(new SystemHealthDto(status, dbHealth, stats, DateTime.UtcNow));
    }

    private async Task<DatabaseHealthDto> CheckDatabaseHealthAsync(CancellationToken ct)
    {
        try
        {
            // Check connectivity and get version
            var version = await db.Database
                .SqlQueryRaw<string>("SELECT version() AS \"Value\"")
                .FirstOrDefaultAsync(ct);

            // Get database size
            var sizeResult = await db.Database
                .SqlQueryRaw<long>("SELECT pg_database_size(current_database()) AS \"Value\"")
                .FirstOrDefaultAsync(ct);

            // Get active connections
            var connections = await db.Database
                .SqlQueryRaw<int>("SELECT count(*)::int AS \"Value\" FROM pg_stat_activity WHERE state = 'active'")
                .FirstOrDefaultAsync(ct);

            return new DatabaseHealthDto(true, version, sizeResult, connections, null);
        }
        catch (Exception ex)
        {
            return new DatabaseHealthDto(false, null, null, null, ex.Message);
        }
    }

    private async Task<SystemStatsDto> GetStatsAsync(CancellationToken ct)
    {
        try
        {
            var totalUsers = await db.Users.CountAsync(ct);
            var activeUsers = await db.Users.CountAsync(u => u.Status == UserStatus.Active, ct);

            // Use raw SQL to count entities that may or may not exist (avoid compile-time references)
            var totalProjects = await SafeCountAsync("projects", ct);
            var totalBids = await SafeCountAsync("bids", ct);
            var totalSubcontracts = await SafeCountAsync("subcontracts", ct);
            var totalTimeEntries = await SafeCountAsync("time_entries", ct);
            var apiKeysActive = await db.Set<ApiKey>().CountAsync(k => k.Status == ApiKeyStatus.Active && !k.IsDeleted, ct);

            return new SystemStatsDto(totalUsers, activeUsers, totalProjects, totalBids,
                totalSubcontracts, totalTimeEntries, apiKeysActive);
        }
        catch
        {
            return new SystemStatsDto(0, 0, 0, 0, 0, 0, 0);
        }
    }

    private static readonly HashSet<string> AllowedTables = new(StringComparer.Ordinal)
    {
        "projects", "bids", "subcontracts", "time_entries",
    };

    private async Task<int> SafeCountAsync(string tableName, CancellationToken ct)
    {
        if (!AllowedTables.Contains(tableName))
            return 0;

        try
        {
            // Table names cannot be parameterized in SQL; the whitelist above prevents injection.
#pragma warning disable EF1002
            return await db.Database
                .SqlQueryRaw<int>($"SELECT count(*)::int AS \"Value\" FROM {tableName} WHERE is_deleted = false")
                .FirstOrDefaultAsync(ct);
#pragma warning restore EF1002
        }
        catch
        {
            return 0;
        }
    }
}
