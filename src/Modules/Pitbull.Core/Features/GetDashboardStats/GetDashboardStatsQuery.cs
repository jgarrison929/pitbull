using Pitbull.Core.CQRS;

namespace Pitbull.Core.Features.GetDashboardStats;

/// <summary>
/// Get dashboard statistics for the current tenant
/// </summary>
public record GetDashboardStatsQuery() : IQuery<DashboardStatsResponse>;

/// <summary>
/// Dashboard statistics response
/// </summary>
public record DashboardStatsResponse(
    int ProjectCount,
    int BidCount,
    decimal TotalProjectValue,
    decimal TotalBidValue,
    int PendingChangeOrders,
    DateTime LastActivityDate
);