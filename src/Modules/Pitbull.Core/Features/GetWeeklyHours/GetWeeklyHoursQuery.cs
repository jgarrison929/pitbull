using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Core.Features.GetWeeklyHours;

/// <summary>
/// Query to get weekly hours for the last N weeks
/// </summary>
public record GetWeeklyHoursQuery(int Weeks = 8) : IRequest<Result<WeeklyHoursResponse>>;

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
/// Handler for getting weekly hours data
/// </summary>
public sealed class GetWeeklyHoursHandler(PitbullDbContext db)
    : IRequestHandler<GetWeeklyHoursQuery, Result<WeeklyHoursResponse>>
{
    public async Task<Result<WeeklyHoursResponse>> Handle(
        GetWeeklyHoursQuery request,
        CancellationToken cancellationToken)
    {
        try
        {
            var weeks = Math.Clamp(request.Weeks, 1, 52);
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
}

// Helper DTO for raw SQL query
internal record WeeklyHoursRow(
    DateTime WeekStart,
    decimal RegularHours,
    decimal OvertimeHours,
    decimal DoubleTimeHours
);
