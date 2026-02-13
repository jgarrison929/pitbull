using Pitbull.Core.CQRS;

namespace Pitbull.Core.Features.Dashboard;

/// <summary>
/// Service for dashboard analytics and statistics
/// </summary>
public interface IDashboardService
{
    /// <summary>
    /// Get dashboard statistics for the current tenant
    /// </summary>
    Task<Result<DashboardStatsResponse>> GetStatsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Get weekly hours data for charts
    /// </summary>
    /// <param name="weeks">Number of weeks to retrieve (1-52)</param>
    Task<Result<WeeklyHoursResponse>> GetWeeklyHoursAsync(int weeks = 8, CancellationToken cancellationToken = default);
}

/// <summary>
/// Dashboard statistics response
/// </summary>
public record DashboardStatsResponse(
    int ProjectCount,
    int BidCount,
    decimal TotalProjectValue,
    decimal TotalBidValue,
    int PendingChangeOrders,
    DateTime LastActivityDate,
    int EmployeeCount,
    int PendingTimeApprovals,
    List<RecentActivityItem> RecentActivity
);

/// <summary>
/// A recent activity item for the dashboard feed
/// </summary>
public record RecentActivityItem(
    string Id,
    string Type,        // "project", "bid", "employee", "timeentry"
    string Title,
    string Description,
    DateTime Timestamp,
    string? Icon
);

/// <summary>
/// Response containing weekly hours data for charts
/// </summary>
public record WeeklyHoursResponse(
    List<WeeklyHoursDataPoint> Data,
    decimal TotalHours,
    decimal AverageHoursPerWeek
);

/// <summary>
/// Single data point for weekly hours
/// </summary>
public record WeeklyHoursDataPoint(
    string WeekLabel,
    DateOnly WeekStart,
    decimal RegularHours,
    decimal OvertimeHours,
    decimal DoubleTimeHours,
    decimal TotalHours
);
