using Pitbull.Core.CQRS;

namespace Pitbull.SystemAdmin.Services;

public interface ISystemHealthService
{
    Task<Result<SystemHealthDto>> GetHealthAsync(CancellationToken ct = default);
}

public record SystemHealthDto(
    string Status,
    DatabaseHealthDto Database,
    SystemStatsDto Stats,
    DateTime CheckedAt
);

public record DatabaseHealthDto(
    bool Connected,
    string? Version,
    long? DatabaseSizeBytes,
    int? ActiveConnections,
    string? Error
);

public record SystemStatsDto(
    int TotalUsers,
    int ActiveUsers,
    int TotalProjects,
    int TotalBids,
    int TotalSubcontracts,
    int TotalTimeEntries,
    int ApiKeysActive
);
