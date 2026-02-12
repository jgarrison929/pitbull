using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using System.Reflection;

namespace Pitbull.Core.Features.GetDashboardStats;

/// <summary>
/// Handler for getting dashboard statistics
/// </summary>
public sealed class GetDashboardStatsHandler(PitbullDbContext db)
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

            // Get pending change orders count from Contracts module
            var pendingChangeOrders = await GetPendingChangeOrders(cancellationToken);

            // Get last activity date (most recent created/updated date across projects and bids)
            var lastActivityDate = await GetLastActivityDate(cancellationToken);

            // Get employee count
            var employeeCount = await GetEmployeeCount(cancellationToken);

            // Get pending time entry approvals
            var pendingTimeApprovals = await GetPendingTimeApprovals(cancellationToken);

            // Get recent activity
            var recentActivity = await GetRecentActivity(cancellationToken);

            var response = new DashboardStatsResponse(
                ProjectCount: projectCount,
                BidCount: bidCount,
                TotalProjectValue: totalProjectValue,
                TotalBidValue: totalBidValue,
                PendingChangeOrders: pendingChangeOrders,
                LastActivityDate: lastActivityDate,
                EmployeeCount: employeeCount,
                PendingTimeApprovals: pendingTimeApprovals,
                RecentActivity: recentActivity
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
                "SELECT COALESCE(SUM(\"ContractAmount\"), 0) AS Value FROM projects WHERE \"IsDeleted\" = false"
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
                "SELECT COALESCE(SUM(\"EstimatedValue\"), 0) AS Value FROM bids WHERE \"IsDeleted\" = false"
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
                SELECT MAX(latest_date) AS Value FROM (
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

    private async Task<int> GetEmployeeCount(CancellationToken cancellationToken)
    {
        try
        {
            var count = await db.Database.SqlQueryRaw<int>(
                "SELECT COALESCE(COUNT(*), 0) AS Value FROM employees WHERE \"IsDeleted\" = false AND \"IsActive\" = true"
            ).FirstAsync(cancellationToken);
            return count;
        }
        catch
        {
            return 0;
        }
    }

    private async Task<int> GetPendingTimeApprovals(CancellationToken cancellationToken)
    {
        try
        {
            // Status = 0 is "Submitted" (pending approval)
            var count = await db.Database.SqlQueryRaw<int>(
                "SELECT COALESCE(COUNT(*), 0) AS Value FROM time_entries WHERE \"IsDeleted\" = false AND \"Status\" = 0"
            ).FirstAsync(cancellationToken);
            return count;
        }
        catch
        {
            return 0;
        }
    }

    private async Task<int> GetPendingChangeOrders(CancellationToken cancellationToken)
    {
        try
        {
            // Status = 0 is "Pending", Status = 1 is "UnderReview" - both are pending approval
            var count = await db.Database.SqlQueryRaw<int>(
                "SELECT COALESCE(COUNT(*), 0) AS Value FROM change_orders WHERE \"IsDeleted\" = false AND \"Status\" IN (0, 1)"
            ).FirstAsync(cancellationToken);
            return count;
        }
        catch
        {
            return 0;
        }
    }

    private async Task<List<RecentActivityItem>> GetRecentActivity(CancellationToken cancellationToken)
    {
        var activities = new List<RecentActivityItem>();

        try
        {
            // Get recent projects (last 5)
            var projectsSql = @"
                SELECT ""Id"", ""Name"", ""Number"", ""CreatedAt""
                FROM projects
                WHERE ""IsDeleted"" = false
                ORDER BY ""CreatedAt"" DESC
                LIMIT 3";

            var projects = await db.Database.SqlQueryRaw<ProjectActivityRow>(projectsSql)
                .ToListAsync(cancellationToken);

            foreach (var p in projects)
            {
                activities.Add(new RecentActivityItem(
                    Id: p.Id.ToString(),
                    Type: "project",
                    Title: p.Name,
                    Description: $"Project {p.Number} created",
                    Timestamp: p.CreatedAt,
                    Icon: "🏗️"
                ));
            }

            // Get recent bids (last 3)
            var bidsSql = @"
                SELECT ""Id"", ""Name"", ""Number"", ""CreatedAt""
                FROM bids
                WHERE ""IsDeleted"" = false
                ORDER BY ""CreatedAt"" DESC
                LIMIT 3";

            var bids = await db.Database.SqlQueryRaw<BidActivityRow>(bidsSql)
                .ToListAsync(cancellationToken);

            foreach (var b in bids)
            {
                activities.Add(new RecentActivityItem(
                    Id: b.Id.ToString(),
                    Type: "bid",
                    Title: b.Name,
                    Description: $"Bid {b.Number} created",
                    Timestamp: b.CreatedAt,
                    Icon: "📋"
                ));
            }

            // Get recent employees (last 2)
            var employeesSql = @"
                SELECT ""Id"", ""FirstName"", ""LastName"", ""EmployeeNumber"", ""CreatedAt""
                FROM employees
                WHERE ""IsDeleted"" = false
                ORDER BY ""CreatedAt"" DESC
                LIMIT 2";

            var employees = await db.Database.SqlQueryRaw<EmployeeActivityRow>(employeesSql)
                .ToListAsync(cancellationToken);

            foreach (var e in employees)
            {
                activities.Add(new RecentActivityItem(
                    Id: e.Id.ToString(),
                    Type: "employee",
                    Title: $"{e.FirstName} {e.LastName}",
                    Description: $"Employee {e.EmployeeNumber} added",
                    Timestamp: e.CreatedAt,
                    Icon: "👤"
                ));
            }

            // Get recent subcontracts (last 2)
            var subcontractsSql = @"
                SELECT ""Id"", ""SubcontractNumber"", ""SubcontractorName"", ""CreatedAt""
                FROM subcontracts
                WHERE ""IsDeleted"" = false
                ORDER BY ""CreatedAt"" DESC
                LIMIT 2";

            var subcontracts = await db.Database.SqlQueryRaw<SubcontractActivityRow>(subcontractsSql)
                .ToListAsync(cancellationToken);

            foreach (var s in subcontracts)
            {
                activities.Add(new RecentActivityItem(
                    Id: s.Id.ToString(),
                    Type: "subcontract",
                    Title: s.SubcontractorName,
                    Description: $"Subcontract {s.SubcontractNumber} created",
                    Timestamp: s.CreatedAt,
                    Icon: "📄"
                ));
            }

            // Sort by timestamp descending and take top 8
            return activities
                .OrderByDescending(a => a.Timestamp)
                .Take(8)
                .ToList();
        }
        catch
        {
            return activities;
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

// Helper DTOs for raw SQL queries
internal record ProjectActivityRow(Guid Id, string Name, string Number, DateTime CreatedAt);
internal record BidActivityRow(Guid Id, string Name, string Number, DateTime CreatedAt);
internal record EmployeeActivityRow(Guid Id, string FirstName, string LastName, string EmployeeNumber, DateTime CreatedAt);
internal record SubcontractActivityRow(Guid Id, string SubcontractNumber, string SubcontractorName, DateTime CreatedAt);