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
            // Note: Column name is "DoubletimeHours" (lowercase 't') per migration
            // Note: Aliases must match DTO property names exactly (EF Core raw SQL mapping)
            var statsSql = $@"
                SELECT 
                    COALESCE(SUM(""RegularHours""), 0) as ""RegularHours"",
                    COALESCE(SUM(""OvertimeHours""), 0) as ""OvertimeHours"",
                    COALESCE(SUM(""DoubletimeHours""), 0) as ""DoubleTimeHours"",
                    COUNT(*) as ""EntryCount"",
                    COUNT(*) FILTER (WHERE ""Status"" = 1) as ""ApprovedCount"",
                    COUNT(*) FILTER (WHERE ""Status"" = 0) as ""PendingCount"",
                    MIN(""Date"") as ""FirstDate"",
                    MAX(""Date"") as ""LastDate""
                FROM time_entries
                WHERE ""ProjectId"" = '{request.ProjectId}'
                  AND ""IsDeleted"" = false";

            var stats = await db.Database.SqlQueryRaw<TimeEntryStatsRow>(statsSql)
                .FirstAsync(cancellationToken);

            // Get assigned employee count
            var employeeCountSql = $@"
                SELECT COUNT(DISTINCT ""EmployeeId"") as ""Value""
                FROM project_assignments
                WHERE ""ProjectId"" = '{request.ProjectId}'
                  AND ""IsActive"" = true";

            var employeeCountResult = await db.Database.SqlQueryRaw<ScalarInt>(employeeCountSql)
                .FirstAsync(cancellationToken);
            var employeeCount = employeeCountResult.Value;

            // Calculate labor cost (simple: hours * average rate)
            // For more accurate costing, use the full LaborCostCalculator
            var laborCostSql = $@"
                SELECT COALESCE(SUM(
                    (te.""RegularHours"" * e.""BaseHourlyRate"") +
                    (te.""OvertimeHours"" * e.""BaseHourlyRate"" * 1.5) +
                    (te.""DoubletimeHours"" * e.""BaseHourlyRate"" * 2.0)
                ), 0) as ""Value""
                FROM time_entries te
                JOIN employees e ON te.""EmployeeId"" = e.""Id""
                WHERE te.""ProjectId"" = '{request.ProjectId}'
                  AND te.""IsDeleted"" = false
                  AND te.""Status"" = 1";

            var laborCostResult = await db.Database.SqlQueryRaw<ScalarDecimal>(laborCostSql)
                .FirstAsync(cancellationToken);
            var laborCost = laborCostResult.Value;

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
// Wrapper DTOs for scalar queries (EF Core SqlQueryRaw doesn't map primitives directly)
internal record ScalarInt(int Value);
internal record ScalarDecimal(decimal Value);
