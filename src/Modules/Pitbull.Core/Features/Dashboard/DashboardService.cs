using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Core.Features.Dashboard;

/// <summary>
/// Service for dashboard analytics and statistics
/// </summary>
public sealed class DashboardService(PitbullDbContext db) : IDashboardService
{
    /// <inheritdoc />
    public async Task<Result<DashboardStatsResponse>> GetStatsAsync(CancellationToken cancellationToken = default)
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

    /// <inheritdoc />
    public async Task<Result<WeeklyHoursResponse>> GetWeeklyHoursAsync(int weeks = 8, CancellationToken cancellationToken = default)
    {
        try
        {
            weeks = Math.Clamp(weeks, 1, 52);
            var endDate = DateOnly.FromDateTime(DateTime.Today);
            var startDate = endDate.AddDays(-7 * weeks);

            // Get weekly aggregated hours using raw SQL
            // Note: Column name is "DoubletimeHours" (lowercase 't') per migration
            // Note: Aliases must match DTO property names exactly (EF Core raw SQL mapping)
            var sql = $@"
                SELECT 
                    DATE_TRUNC('week', ""Date""::timestamp)::date as ""WeekStart"",
                    COALESCE(SUM(""RegularHours""), 0) as ""RegularHours"",
                    COALESCE(SUM(""OvertimeHours""), 0) as ""OvertimeHours"",
                    COALESCE(SUM(""DoubletimeHours""), 0) as ""DoubleTimeHours""
                FROM time_entries
                WHERE ""IsDeleted"" = false
                  AND ""Date"" >= '{startDate:yyyy-MM-dd}'
                  AND ""Date"" <= '{endDate:yyyy-MM-dd}'
                GROUP BY DATE_TRUNC('week', ""Date""::timestamp)
                ORDER BY ""WeekStart""";

            var rawData = await db.Database.SqlQueryRaw<WeeklyHoursRow>(sql)
                .ToListAsync(cancellationToken);

            // Build complete week list (fill in zeros for missing weeks)
            var dataPoints = new List<WeeklyHoursDataPoint>();
            var currentWeek = GetMondayOfWeek(startDate);
            var lastWeek = GetMondayOfWeek(endDate);

            while (currentWeek <= lastWeek)
            {
                var weekData = rawData.FirstOrDefault(r =>
                    DateOnly.FromDateTime(r.WeekStart) == currentWeek);

                var regular = weekData?.RegularHours ?? 0;
                var ot = weekData?.OvertimeHours ?? 0;
                var dt = weekData?.DoubleTimeHours ?? 0;

                dataPoints.Add(new WeeklyHoursDataPoint(
                    WeekLabel: currentWeek.ToString("MMM d"),
                    WeekStart: currentWeek,
                    RegularHours: regular,
                    OvertimeHours: ot,
                    DoubleTimeHours: dt,
                    TotalHours: regular + ot + dt
                ));

                currentWeek = currentWeek.AddDays(7);
            }

            var totalHours = dataPoints.Sum(d => d.TotalHours);
            var avgHours = dataPoints.Count > 0 ? totalHours / dataPoints.Count : 0;

            return Result.Success(new WeeklyHoursResponse(
                Data: dataPoints,
                TotalHours: totalHours,
                AverageHoursPerWeek: avgHours
            ));
        }
        catch (Exception ex)
        {
            return Result.Failure<WeeklyHoursResponse>(
                $"Failed to retrieve weekly hours: {ex.Message}",
                "WEEKLY_HOURS_ERROR");
        }
    }

    private static DateOnly GetMondayOfWeek(DateOnly date)
    {
        var diff = (7 + (date.DayOfWeek - DayOfWeek.Monday)) % 7;
        return date.AddDays(-diff);
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
                "SELECT COALESCE(SUM(\"ContractAmount\"), 0) AS \"Value\" FROM projects WHERE \"IsDeleted\" = false"
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
                "SELECT COALESCE(SUM(\"EstimatedValue\"), 0) AS \"Value\" FROM bids WHERE \"IsDeleted\" = false"
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
                SELECT MAX(latest_date) AS ""Value"" FROM (
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
                "SELECT COALESCE(COUNT(*), 0) AS \"Value\" FROM employees WHERE \"IsDeleted\" = false AND \"IsActive\" = true"
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
                "SELECT COALESCE(COUNT(*), 0) AS \"Value\" FROM time_entries WHERE \"IsDeleted\" = false AND \"Status\" = 0"
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
            // Status is stored as string (HasConversion<string>) - use string values
            var count = await db.Database.SqlQueryRaw<int>(
                "SELECT COALESCE(COUNT(*), 0) AS \"Value\" FROM change_orders WHERE \"IsDeleted\" = false AND \"Status\" IN ('Pending', 'UnderReview')"
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
            // Get recent projects (last 3)
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

    /// <inheritdoc />
    public async Task<Result<RfisNeedingAttentionResponse>> GetRfisNeedingAttentionAsync(Guid? userId = null, int limit = 5, CancellationToken cancellationToken = default)
    {
        limit = Math.Clamp(limit, 1, 20);
        var today = DateTime.UtcNow.Date;

        // Get RFIs needing attention - gracefully handle SQL failures
        var items = await GetRfiAttentionItems(userId, limit, today, cancellationToken);

        // Get counts - these methods handle their own exceptions
        var overdueCount = await GetOverdueRfiCount(today, cancellationToken);
        var ballInCourtCount = userId.HasValue
            ? await GetBallInCourtRfiCount(userId.Value, cancellationToken)
            : 0;

        return Result.Success(new RfisNeedingAttentionResponse(
            OverdueCount: overdueCount,
            BallInCourtCount: ballInCourtCount,
            TotalCount: items.Count,
            Items: items
        ));
    }

    private async Task<List<RfiAttentionItem>> GetRfiAttentionItems(Guid? userId, int limit, DateTime today, CancellationToken cancellationToken)
    {
        try
        {
            // Build the SQL query to get RFIs needing attention
            // Status = 'Open' (0) - only open RFIs need attention
            // Either overdue (DueDate < today) or ball-in-court = current user
            var userFilter = userId.HasValue
                ? $@"OR ""BallInCourtUserId"" = '{userId.Value}'"
                : "";

            var sql = $@"
                SELECT 
                    r.""Id"",
                    r.""Number"",
                    r.""Subject"",
                    r.""ProjectId"",
                    p.""Name"" as ""ProjectName"",
                    p.""Number"" as ""ProjectNumber"",
                    r.""Priority"",
                    r.""DueDate"",
                    r.""BallInCourtUserId"",
                    r.""BallInCourtName""
                FROM rfis r
                INNER JOIN projects p ON r.""ProjectId"" = p.""Id""
                WHERE r.""IsDeleted"" = false
                  AND p.""IsDeleted"" = false
                  AND r.""Status"" = 'Open'
                  AND (
                      (r.""DueDate"" IS NOT NULL AND r.""DueDate"" < '{today:yyyy-MM-dd}'::timestamp)
                      {userFilter}
                  )
                ORDER BY 
                    CASE WHEN r.""DueDate"" IS NOT NULL AND r.""DueDate"" < '{today:yyyy-MM-dd}'::timestamp THEN 0 ELSE 1 END,
                    r.""DueDate"" ASC NULLS LAST,
                    r.""Priority"" DESC,
                    r.""CreatedAt"" DESC
                LIMIT {limit}";

            var rawData = await db.Database.SqlQueryRaw<RfiAttentionRow>(sql)
                .ToListAsync(cancellationToken);

            return rawData.Select(r =>
            {
                var isOverdue = r.DueDate.HasValue && r.DueDate.Value.Date < today;
                var daysOverdue = isOverdue ? (int)(today - r.DueDate!.Value.Date).TotalDays : 0;
                var isBallInCourt = userId.HasValue && r.BallInCourtUserId == userId.Value;

                return new RfiAttentionItem(
                    Id: r.Id,
                    Number: r.Number,
                    Subject: r.Subject,
                    ProjectId: r.ProjectId.ToString(),
                    ProjectName: r.ProjectName,
                    ProjectNumber: r.ProjectNumber,
                    Priority: r.Priority,
                    DueDate: r.DueDate,
                    DaysOverdue: daysOverdue,
                    IsOverdue: isOverdue,
                    IsBallInCourt: isBallInCourt,
                    BallInCourtName: r.BallInCourtName
                );
            }).ToList();
        }
        catch
        {
            return [];
        }
    }

    private async Task<int> GetOverdueRfiCount(DateTime today, CancellationToken cancellationToken)
    {
        try
        {
            var count = await db.Database.SqlQuery<int>(
                $@"SELECT COALESCE(COUNT(*), 0) AS ""Value""
                   FROM rfis
                   WHERE ""IsDeleted"" = false
                     AND ""Status"" = 'Open'
                     AND ""DueDate"" IS NOT NULL
                     AND ""DueDate"" < {today}"
            ).FirstAsync(cancellationToken);
            return count;
        }
        catch
        {
            return 0;
        }
    }

    private async Task<int> GetBallInCourtRfiCount(Guid userId, CancellationToken cancellationToken)
    {
        try
        {
            var count = await db.Database.SqlQuery<int>(
                $@"SELECT COALESCE(COUNT(*), 0) AS ""Value""
                   FROM rfis
                   WHERE ""IsDeleted"" = false
                     AND ""Status"" = 'Open'
                     AND ""BallInCourtUserId"" = {userId}"
            ).FirstAsync(cancellationToken);
            return count;
        }
        catch
        {
            return 0;
        }
    }
}

// Helper DTOs for raw SQL queries
internal record ProjectActivityRow(Guid Id, string Name, string Number, DateTime CreatedAt);
internal record BidActivityRow(Guid Id, string Name, string Number, DateTime CreatedAt);
internal record EmployeeActivityRow(Guid Id, string FirstName, string LastName, string EmployeeNumber, DateTime CreatedAt);
internal record SubcontractActivityRow(Guid Id, string SubcontractNumber, string SubcontractorName, DateTime CreatedAt);
internal record WeeklyHoursRow(DateTime WeekStart, decimal RegularHours, decimal OvertimeHours, decimal DoubleTimeHours);
internal record RfiAttentionRow(Guid Id, int Number, string Subject, Guid ProjectId, string ProjectName, string ProjectNumber, string Priority, DateTime? DueDate, Guid? BallInCourtUserId, string? BallInCourtName);
