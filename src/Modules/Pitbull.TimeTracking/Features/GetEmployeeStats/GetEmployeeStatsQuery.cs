using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.TimeTracking.Features.GetEmployeeStats;

/// <summary>
/// Query to get employee statistics (hours, projects, entries)
/// </summary>
public record GetEmployeeStatsQuery(Guid EmployeeId) : IRequest<Result<EmployeeStatsResponse>>;

/// <summary>
/// Response containing employee statistics
/// </summary>
public record EmployeeStatsResponse(
    Guid EmployeeId,
    string FullName,
    string EmployeeNumber,
    decimal TotalHours,
    decimal RegularHours,
    decimal OvertimeHours,
    decimal DoubleTimeHours,
    decimal TotalEarnings,
    int TimeEntryCount,
    int ApprovedEntryCount,
    int PendingEntryCount,
    int ProjectCount,
    DateOnly? FirstEntryDate,
    DateOnly? LastEntryDate
);

/// <summary>
/// Handler for getting employee statistics
/// </summary>
public sealed class GetEmployeeStatsHandler(PitbullDbContext db)
    : IRequestHandler<GetEmployeeStatsQuery, Result<EmployeeStatsResponse>>
{
    public async Task<Result<EmployeeStatsResponse>> Handle(
        GetEmployeeStatsQuery request,
        CancellationToken cancellationToken)
    {
        try
        {
            // Verify employee exists and get basic info
            var employeeSql = $@"
                SELECT ""Id"", ""FirstName"", ""LastName"", ""EmployeeNumber"", ""BaseHourlyRate""
                FROM employees
                WHERE ""Id"" = '{request.EmployeeId}'
                  AND ""IsDeleted"" = false
                LIMIT 1";

            var employee = await db.Database.SqlQueryRaw<EmployeeRow>(employeeSql)
                .FirstOrDefaultAsync(cancellationToken);

            if (employee == null)
            {
                return Result.Failure<EmployeeStatsResponse>(
                    "Employee not found",
                    "EMPLOYEE_NOT_FOUND");
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
                    COUNT(DISTINCT ""ProjectId"") as ""ProjectCount"",
                    MIN(""Date"") as ""FirstDate"",
                    MAX(""Date"") as ""LastDate""
                FROM time_entries
                WHERE ""EmployeeId"" = '{request.EmployeeId}'
                  AND ""IsDeleted"" = false";

            var stats = await db.Database.SqlQueryRaw<TimeEntryStatsRow>(statsSql)
                .FirstAsync(cancellationToken);

            var totalHours = stats.RegularHours + stats.OvertimeHours + stats.DoubleTimeHours;

            // Calculate earnings using employee's rate
            var totalEarnings =
                (stats.RegularHours * employee.BaseHourlyRate) +
                (stats.OvertimeHours * employee.BaseHourlyRate * 1.5m) +
                (stats.DoubleTimeHours * employee.BaseHourlyRate * 2.0m);

            return Result.Success(new EmployeeStatsResponse(
                EmployeeId: request.EmployeeId,
                FullName: $"{employee.FirstName} {employee.LastName}",
                EmployeeNumber: employee.EmployeeNumber,
                TotalHours: totalHours,
                RegularHours: stats.RegularHours,
                OvertimeHours: stats.OvertimeHours,
                DoubleTimeHours: stats.DoubleTimeHours,
                TotalEarnings: totalEarnings,
                TimeEntryCount: stats.EntryCount,
                ApprovedEntryCount: stats.ApprovedCount,
                PendingEntryCount: stats.PendingCount,
                ProjectCount: stats.ProjectCount,
                FirstEntryDate: stats.FirstDate.HasValue ? DateOnly.FromDateTime(stats.FirstDate.Value) : null,
                LastEntryDate: stats.LastDate.HasValue ? DateOnly.FromDateTime(stats.LastDate.Value) : null
            ));
        }
        catch (Exception ex)
        {
            return Result.Failure<EmployeeStatsResponse>(
                $"Failed to retrieve employee statistics: {ex.Message}",
                "EMPLOYEE_STATS_ERROR");
        }
    }
}

// Helper DTOs for raw SQL queries
internal record EmployeeRow(Guid Id, string FirstName, string LastName, string EmployeeNumber, decimal BaseHourlyRate);
internal record TimeEntryStatsRow(
    decimal RegularHours,
    decimal OvertimeHours,
    decimal DoubleTimeHours,
    int EntryCount,
    int ApprovedCount,
    int PendingCount,
    int ProjectCount,
    DateTime? FirstDate,
    DateTime? LastDate
);
