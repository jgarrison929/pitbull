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

    /// <summary>
    /// Get RFIs that need attention (overdue or assigned to user)
    /// </summary>
    /// <param name="userId">Optional user ID to filter by ball-in-court assignment</param>
    /// <param name="limit">Maximum number of RFIs to return</param>
    Task<Result<RfisNeedingAttentionResponse>> GetRfisNeedingAttentionAsync(Guid? userId = null, int limit = 5, CancellationToken cancellationToken = default);
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
    int TimeEntryCount,
    int CostCodeCount,
    int PayPeriodCount,
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

/// <summary>
/// Response containing RFIs that need attention
/// </summary>
public record RfisNeedingAttentionResponse(
    int OverdueCount,
    int BallInCourtCount,
    int TotalCount,
    List<RfiAttentionItem> Items
);

/// <summary>
/// An RFI item that needs attention
/// </summary>
public record RfiAttentionItem(
    Guid Id,
    int Number,
    string Subject,
    string ProjectId,
    string ProjectName,
    string ProjectNumber,
    string Priority,
    DateTime? DueDate,
    int DaysOverdue,
    bool IsOverdue,
    bool IsBallInCourt,
    string? BallInCourtName
);
