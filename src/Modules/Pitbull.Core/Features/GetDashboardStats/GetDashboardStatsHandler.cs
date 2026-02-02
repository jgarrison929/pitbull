using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using System.Reflection;

namespace Pitbull.Core.Features.GetDashboardStats;

/// <summary>
/// Handler for getting dashboard statistics
/// </summary>
public class GetDashboardStatsHandler(PitbullDbContext db) 
    : IRequestHandler<GetDashboardStatsQuery, Result<DashboardStatsResponse>>
{
    public async Task<Result<DashboardStatsResponse>> Handle(
        GetDashboardStatsQuery request, 
        CancellationToken cancellationToken)
    {
        try
        {
            // Get project count and total value
            var (projectCount, totalProjectValue) = await GetProjectStats(cancellationToken);

            // Get bid count and total value
            var (bidCount, totalBidValue) = await GetBidStats(cancellationToken);

            // Get pending change orders count (for now return 0, will implement when change orders module exists)
            var pendingChangeOrders = 0;

            // Get last activity date (most recent created/updated date across projects and bids)
            var lastActivityDate = await GetLastActivityDate(cancellationToken);

            var response = new DashboardStatsResponse(
                ProjectCount: projectCount,
                BidCount: bidCount,
                TotalProjectValue: totalProjectValue,
                TotalBidValue: totalBidValue,
                PendingChangeOrders: pendingChangeOrders,
                LastActivityDate: lastActivityDate
            );

            return Result.Success(response);
        }
        catch (Exception ex)
        {
            return Result.Failure<DashboardStatsResponse>(
                $"Failed to retrieve dashboard statistics: {ex.Message}",
                "DASHBOARD_STATS_ERROR");
        }
    }

    private async Task<(int count, decimal totalValue)> GetProjectStats(CancellationToken cancellationToken)
    {
        try
        {
            var projectType = GetEntityType("Pitbull.Projects.Domain.Project");
            if (projectType == null)
                return (0, 0);

            var setMethod = typeof(DbContext).GetMethod("Set", Type.EmptyTypes)?.MakeGenericMethod(projectType);
            if (setMethod == null)
                return (0, 0);

            var dbSet = setMethod.Invoke(db, null) as IQueryable;
            if (dbSet == null)
                return (0, 0);

            // Get count
            var count = await dbSet.OfType<object>().CountAsync(cancellationToken);

            // Get total contract amount using raw SQL to avoid complex reflection
            var totalValue = await db.Database.SqlQueryRaw<decimal>(
                "SELECT COALESCE(SUM(\"ContractAmount\"), 0) FROM projects WHERE \"IsDeleted\" = false"
            ).FirstAsync(cancellationToken);

            return (count, totalValue);
        }
        catch
        {
            return (0, 0);
        }
    }

    private async Task<(int count, decimal totalValue)> GetBidStats(CancellationToken cancellationToken)
    {
        try
        {
            var bidType = GetEntityType("Pitbull.Bids.Domain.Bid");
            if (bidType == null)
                return (0, 0);

            var setMethod = typeof(DbContext).GetMethod("Set", Type.EmptyTypes)?.MakeGenericMethod(bidType);
            if (setMethod == null)
                return (0, 0);

            var dbSet = setMethod.Invoke(db, null) as IQueryable;
            if (dbSet == null)
                return (0, 0);

            // Get count
            var count = await dbSet.OfType<object>().CountAsync(cancellationToken);

            // Get total estimated value using raw SQL to avoid complex reflection
            var totalValue = await db.Database.SqlQueryRaw<decimal>(
                "SELECT COALESCE(SUM(\"EstimatedValue\"), 0) FROM bids WHERE \"IsDeleted\" = false"
            ).FirstAsync(cancellationToken);

            return (count, totalValue);
        }
        catch
        {
            return (0, 0);
        }
    }

    private async Task<DateTime> GetLastActivityDate(CancellationToken cancellationToken)
    {
        var defaultDate = DateTime.UtcNow.AddDays(-30); // Default to 30 days ago if no activity

        try
        {
            // Use raw SQL to get the latest activity across both projects and bids
            var sql = @"
                SELECT MAX(latest_date) FROM (
                    SELECT MAX(COALESCE(""UpdatedAt"", ""CreatedAt"")) as latest_date 
                    FROM projects 
                    WHERE ""IsDeleted"" = false
                    UNION ALL
                    SELECT MAX(COALESCE(""UpdatedAt"", ""CreatedAt"")) as latest_date 
                    FROM bids 
                    WHERE ""IsDeleted"" = false
                ) combined";

            var result = await db.Database.SqlQueryRaw<DateTime?>(sql).FirstAsync(cancellationToken);
            return result ?? defaultDate;
        }
        catch
        {
            return defaultDate;
        }
    }

    private static Type? GetEntityType(string fullTypeName)
    {
        foreach (var assembly in AppDomain.CurrentDomain.GetAssemblies())
        {
            var type = assembly.GetType(fullTypeName);
            if (type != null)
                return type;
        }
        return null;
    }
}