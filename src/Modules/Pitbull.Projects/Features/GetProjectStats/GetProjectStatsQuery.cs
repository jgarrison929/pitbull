using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Projects.Features.GetProjectStats;

/// <summary>
/// Query to get project statistics (hours, costs, employees)
/// </summary>
public record GetProjectStatsQuery(Guid ProjectId) : IRequest<Result<ProjectStatsResponse>>;

/// <summary>
/// Response containing project statistics
/// </summary>
public record ProjectStatsResponse(
    Guid ProjectId,
    string ProjectName,
    string ProjectNumber,
    decimal TotalHours,
    decimal RegularHours,
    decimal OvertimeHours,
    decimal DoubleTimeHours,
    decimal TotalLaborCost,
    int TimeEntryCount,
    int ApprovedEntryCount,
    int PendingEntryCount,
    int AssignedEmployeeCount,
    DateOnly? FirstEntryDate,
    DateOnly? LastEntryDate
);

/// <summary>
/// Handler for getting project statistics
/// </summary>
public sealed class GetProjectStatsHandler(PitbullDbContext db)
    : IRequestHandler<GetProjectStatsQuery, Result<ProjectStatsResponse>>
{
    public async Task<Result<ProjectStatsResponse>> Handle(
        GetProjectStatsQuery request,
        CancellationToken cancellationToken)
    {
        try
        {
            // Verify project exists
            var projectSql = $@"
                SELECT ""Id"", ""Name"", ""Number""
                FROM projects
                WHERE ""Id"" = '{request.ProjectId}'
                  AND ""IsDeleted"" = false
                LIMIT 1";

            var project = await db.Database.SqlQueryRaw<ProjectRow>(projectSql)
                .FirstOrDefaultAsync(cancellationToken);

            if (project == null)
            {
                return Result.Failure<ProjectStatsResponse>(
                    "Project not found",
                    "PROJECT_NOT_FOUND");
            }

            // Get time entry stats
            var statsSql = $@"
                SELECT 
                    COALESCE(SUM(""RegularHours""), 0) as regular_hours,
                    COALESCE(SUM(""OvertimeHours""), 0) as overtime_hours,
                    COALESCE(SUM(""DoubleTimeHours""), 0) as doubletime_hours,
                    COUNT(*) as entry_count,
                    COUNT(*) FILTER (WHERE ""Status"" = 1) as approved_count,
                    COUNT(*) FILTER (WHERE ""Status"" = 0) as pending_count,
                    MIN(""Date"") as first_date,
                    MAX(""Date"") as last_date
                FROM time_entries
                WHERE ""ProjectId"" = '{request.ProjectId}'
                  AND ""IsDeleted"" = false";

            var stats = await db.Database.SqlQueryRaw<TimeEntryStatsRow>(statsSql)
                .FirstAsync(cancellationToken);

            // Get assigned employee count
            var employeeCountSql = $@"
                SELECT COUNT(DISTINCT ""EmployeeId"") as Value
                FROM project_assignments
                WHERE ""ProjectId"" = '{request.ProjectId}'
                  AND ""IsActive"" = true";

            var employeeCount = await db.Database.SqlQueryRaw<int>(employeeCountSql)
                .FirstAsync(cancellationToken);

            // Calculate labor cost (simple: hours * average rate)
            // For more accurate costing, use the full LaborCostCalculator
            var laborCostSql = $@"
                SELECT COALESCE(SUM(
                    (te.""RegularHours"" * e.""BaseHourlyRate"") +
                    (te.""OvertimeHours"" * e.""BaseHourlyRate"" * 1.5) +
                    (te.""DoubleTimeHours"" * e.""BaseHourlyRate"" * 2.0)
                ), 0) as Value
                FROM time_entries te
                JOIN employees e ON te.""EmployeeId"" = e.""Id""
                WHERE te.""ProjectId"" = '{request.ProjectId}'
                  AND te.""IsDeleted"" = false
                  AND te.""Status"" = 1";

            var laborCost = await db.Database.SqlQueryRaw<decimal>(laborCostSql)
                .FirstAsync(cancellationToken);

            var totalHours = stats.RegularHours + stats.OvertimeHours + stats.DoubleTimeHours;

            return Result.Success(new ProjectStatsResponse(
                ProjectId: request.ProjectId,
                ProjectName: project.Name,
                ProjectNumber: project.Number,
                TotalHours: totalHours,
                RegularHours: stats.RegularHours,
                OvertimeHours: stats.OvertimeHours,
                DoubleTimeHours: stats.DoubleTimeHours,
                TotalLaborCost: laborCost,
                TimeEntryCount: stats.EntryCount,
                ApprovedEntryCount: stats.ApprovedCount,
                PendingEntryCount: stats.PendingCount,
                AssignedEmployeeCount: employeeCount,
                FirstEntryDate: stats.FirstDate.HasValue ? DateOnly.FromDateTime(stats.FirstDate.Value) : null,
                LastEntryDate: stats.LastDate.HasValue ? DateOnly.FromDateTime(stats.LastDate.Value) : null
            ));
        }
        catch (Exception ex)
        {
            return Result.Failure<ProjectStatsResponse>(
                $"Failed to retrieve project statistics: {ex.Message}",
                "PROJECT_STATS_ERROR");
        }
    }
}

// Helper DTOs for raw SQL queries
internal record ProjectRow(Guid Id, string Name, string Number);
internal record TimeEntryStatsRow(
    decimal RegularHours,
    decimal OvertimeHours,
    decimal DoubleTimeHours,
    int EntryCount,
    int ApprovedCount,
    int PendingCount,
    DateTime? FirstDate,
    DateTime? LastDate
);
