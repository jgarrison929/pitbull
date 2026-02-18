using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Services;

namespace Pitbull.Api.Services;

public interface IDataExportService
{
    Task<ExportFileResult> ExportTimeEntriesVistaAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken = default);
    Task<ExportFileResult> ExportEmployeesCsvAsync(CancellationToken cancellationToken = default);
    Task<ExportFileResult> ExportProjectsCsvAsync(CancellationToken cancellationToken = default);
    Task<ExportFileResult> ExportCostCodesCsvAsync(CancellationToken cancellationToken = default);
}

public class DataExportService(
    PitbullDbContext db,
    ITimeEntryService timeEntryService) : IDataExportService
{
    public async Task<ExportFileResult> ExportTimeEntriesVistaAsync(
        DateOnly from,
        DateOnly to,
        CancellationToken cancellationToken = default)
    {
        var result = await timeEntryService.ExportVistaTimesheetAsync(from, to, null, cancellationToken);
        if (!result.IsSuccess || result.Value is null)
            throw new InvalidOperationException(result.Error ?? "Failed to export Vista time entries");

        return new ExportFileResult(
            result.Value.FileName,
            "text/csv",
            result.Value.CsvContent);
    }

    public async Task<ExportFileResult> ExportEmployeesCsvAsync(CancellationToken cancellationToken = default)
    {
        var employees = await db.Set<Employee>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted)
            .OrderBy(x => x.EmployeeNumber)
            .ToListAsync(cancellationToken);

        var builder = new StringBuilder();
        builder.AppendLine("EmployeeNumber,FirstName,LastName,Email,Department,JobTitle,PayRate,HireDate");

        foreach (var employee in employees)
        {
            var department = string.Empty;
            if (!string.IsNullOrWhiteSpace(employee.Notes) && employee.Notes.StartsWith("Department:", StringComparison.OrdinalIgnoreCase))
            {
                department = employee.Notes["Department:".Length..].Trim();
            }

            builder.AppendLine(string.Join(",",
                Escape(employee.EmployeeNumber),
                Escape(employee.FirstName),
                Escape(employee.LastName),
                Escape(employee.Email),
                Escape(department),
                Escape(employee.Title),
                employee.BaseHourlyRate.ToString(CultureInfo.InvariantCulture),
                employee.HireDate?.ToString("yyyy-MM-dd") ?? string.Empty));
        }

        return new ExportFileResult(
            $"employees-{DateTime.UtcNow:yyyyMMdd}.csv",
            "text/csv",
            builder.ToString());
    }

    public async Task<ExportFileResult> ExportProjectsCsvAsync(CancellationToken cancellationToken = default)
    {
        var projects = await db.Set<Project>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted)
            .OrderBy(x => x.Number)
            .ToListAsync(cancellationToken);

        var builder = new StringBuilder();
        builder.AppendLine("ProjectNumber,Name,Description,StartDate,EndDate,ContractAmount,Status");

        foreach (var project in projects)
        {
            builder.AppendLine(string.Join(",",
                Escape(project.Number),
                Escape(project.Name),
                Escape(project.Description),
                project.StartDate?.ToString("yyyy-MM-dd") ?? string.Empty,
                project.EstimatedCompletionDate?.ToString("yyyy-MM-dd") ?? string.Empty,
                project.ContractAmount.ToString(CultureInfo.InvariantCulture),
                Escape(project.Status.ToString())));
        }

        return new ExportFileResult(
            $"projects-{DateTime.UtcNow:yyyyMMdd}.csv",
            "text/csv",
            builder.ToString());
    }

    public async Task<ExportFileResult> ExportCostCodesCsvAsync(CancellationToken cancellationToken = default)
    {
        var costCodes = await db.Set<CostCode>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted)
            .OrderBy(x => x.Code)
            .ToListAsync(cancellationToken);

        var builder = new StringBuilder();
        builder.AppendLine("Code,Description,Category,UnitOfMeasure");

        foreach (var costCode in costCodes)
        {
            var description = costCode.Description;
            var unitOfMeasure = string.Empty;
            const string marker = " (UOM:";
            var markerIndex = description.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
            if (markerIndex >= 0)
            {
                var endIndex = description.IndexOf(')', markerIndex);
                if (endIndex > markerIndex)
                {
                    unitOfMeasure = description[(markerIndex + marker.Length)..endIndex].Trim();
                    description = description[..markerIndex].Trim();
                }
            }

            builder.AppendLine(string.Join(",",
                Escape(costCode.Code),
                Escape(description),
                Escape(costCode.Division),
                Escape(unitOfMeasure)));
        }

        return new ExportFileResult(
            $"cost-codes-{DateTime.UtcNow:yyyyMMdd}.csv",
            "text/csv",
            builder.ToString());
    }

    private static string Escape(string? value)
    {
        if (string.IsNullOrEmpty(value))
            return string.Empty;

        // Prevent CSV formula injection: prefix formula-triggering chars with a single quote
        var escaped = value;
        if (escaped.Length > 0 && escaped[0] is '=' or '+' or '-' or '@')
            escaped = "'" + escaped;

        escaped = escaped.Replace("\"", "\"\"");
        if (escaped.Contains(',') || escaped.Contains('"') || escaped.Contains('\n') || escaped.Contains('\r'))
            return $"\"{escaped}\"";

        return escaped;
    }
}

public record ExportFileResult(
    string FileName,
    string ContentType,
    string Content);
