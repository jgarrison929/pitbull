using System.Globalization;
using System.Text;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features.ExportVistaTimesheet;

/// <summary>
/// Handler for exporting time entries in Vista/Viewpoint compatible CSV format.
/// 
/// Vista CSV format follows standard Viewpoint timesheet import specifications:
/// - One row per time entry (employee + project + cost code + date combination)
/// - Separate columns for regular, overtime, and doubletime hours
/// - Employee and project numbers match Vista master file codes
/// </summary>
public sealed class ExportVistaTimesheetHandler(PitbullDbContext db)
    : IRequestHandler<ExportVistaTimesheetQuery, Result<VistaExportResult>>
{
    /// <summary>
    /// Vista standard CSV headers for timesheet import
    /// </summary>
    private static readonly string[] Headers =
    [
        "EmployeeNumber",
        "EmployeeName",
        "WorkDate",
        "ProjectNumber",
        "ProjectName",
        "CostCode",
        "CostCodeDescription",
        "RegularHours",
        "OvertimeHours",
        "DoubletimeHours",
        "TotalHours",
        "HourlyRate",
        "RegularAmount",
        "OvertimeAmount",
        "DoubletimeAmount",
        "TotalAmount",
        "ApprovalStatus",
        "ApprovedBy",
        "ApprovedDate"
    ];

    public async Task<Result<VistaExportResult>> Handle(
        ExportVistaTimesheetQuery request, CancellationToken cancellationToken)
    {
        // Validate date range
        if (request.EndDate < request.StartDate)
        {
            return Result.Failure<VistaExportResult>(
                "End date must be greater than or equal to start date",
                "INVALID_DATE_RANGE");
        }

        // Prevent exports spanning more than one year
        var daysDiff = request.EndDate.DayNumber - request.StartDate.DayNumber;
        if (daysDiff > 366)
        {
            return Result.Failure<VistaExportResult>(
                "Export date range cannot exceed one year",
                "DATE_RANGE_TOO_LARGE");
        }

        // Build query for approved time entries only
        var query = db.Set<TimeEntry>()
            .Include(te => te.Employee)
            .Include(te => te.Project)
            .Include(te => te.CostCode)
            .Include(te => te.ApprovedBy)
            .Where(te => te.Status == TimeEntryStatus.Approved)
            .Where(te => te.Date >= request.StartDate && te.Date <= request.EndDate);

        // Apply optional project filter
        if (request.ProjectId.HasValue)
        {
            var projectExists = await db.Set<Project>()
                .AnyAsync(p => p.Id == request.ProjectId.Value, cancellationToken);

            if (!projectExists)
            {
                return Result.Failure<VistaExportResult>("Project not found", "NOT_FOUND");
            }

            query = query.Where(te => te.ProjectId == request.ProjectId.Value);
        }

        // Order by employee, then date, then project for logical grouping
        var timeEntries = await query
            .OrderBy(te => te.Employee.EmployeeNumber)
            .ThenBy(te => te.Date)
            .ThenBy(te => te.Project.Number)
            .ThenBy(te => te.CostCode.Code)
            .ToListAsync(cancellationToken);

        // Generate CSV content
        var csvContent = GenerateCsv(timeEntries);

        // Calculate summary statistics
        var totalHours = timeEntries.Sum(te => te.TotalHours);
        var employeeCount = timeEntries.Select(te => te.EmployeeId).Distinct().Count();
        var projectCount = timeEntries.Select(te => te.ProjectId).Distinct().Count();

        // Generate filename with date range
        var fileName = $"vista-timesheet-{request.StartDate:yyyyMMdd}-{request.EndDate:yyyyMMdd}.csv";

        return Result.Success(new VistaExportResult
        {
            CsvContent = csvContent,
            FileName = fileName,
            RowCount = timeEntries.Count,
            TotalHours = totalHours,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            EmployeeCount = employeeCount,
            ProjectCount = projectCount
        });
    }

    private static string GenerateCsv(List<TimeEntry> timeEntries)
    {
        var sb = new StringBuilder();

        // Write header row
        sb.AppendLine(string.Join(",", Headers.Select(EscapeCsvField)));

        // Write data rows
        foreach (var entry in timeEntries)
        {
            var row = FormatTimeEntryRow(entry);
            sb.AppendLine(string.Join(",", row.Select(EscapeCsvField)));
        }

        return sb.ToString();
    }

    private static string[] FormatTimeEntryRow(TimeEntry entry)
    {
        // Calculate amounts using Vista standard overtime multipliers
        const decimal overtimeMultiplier = 1.5m;
        const decimal doubletimeMultiplier = 2.0m;

        var hourlyRate = entry.Employee.BaseHourlyRate;
        var regularAmount = entry.RegularHours * hourlyRate;
        var overtimeAmount = entry.OvertimeHours * hourlyRate * overtimeMultiplier;
        var doubletimeAmount = entry.DoubletimeHours * hourlyRate * doubletimeMultiplier;
        var totalAmount = regularAmount + overtimeAmount + doubletimeAmount;

        return
        [
            entry.Employee.EmployeeNumber,
            entry.Employee.FullName,
            entry.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            entry.Project.Number ?? string.Empty,
            entry.Project.Name,
            entry.CostCode.Code,
            entry.CostCode.Description,
            entry.RegularHours.ToString("F2", CultureInfo.InvariantCulture),
            entry.OvertimeHours.ToString("F2", CultureInfo.InvariantCulture),
            entry.DoubletimeHours.ToString("F2", CultureInfo.InvariantCulture),
            entry.TotalHours.ToString("F2", CultureInfo.InvariantCulture),
            hourlyRate.ToString("F2", CultureInfo.InvariantCulture),
            regularAmount.ToString("F2", CultureInfo.InvariantCulture),
            overtimeAmount.ToString("F2", CultureInfo.InvariantCulture),
            doubletimeAmount.ToString("F2", CultureInfo.InvariantCulture),
            totalAmount.ToString("F2", CultureInfo.InvariantCulture),
            entry.Status.ToString(),
            entry.ApprovedBy?.FullName ?? string.Empty,
            entry.ApprovedAt?.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture) ?? string.Empty
        ];
    }

    /// <summary>
    /// Escape a field for CSV format (RFC 4180 compliant)
    /// </summary>
    private static string EscapeCsvField(string? field)
    {
        if (string.IsNullOrEmpty(field))
            return string.Empty;

        // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
        if (field.Contains(',') || field.Contains('"') || field.Contains('\n') || field.Contains('\r'))
        {
            return $"\"{field.Replace("\"", "\"\"")}\"";
        }

        return field;
    }
}
