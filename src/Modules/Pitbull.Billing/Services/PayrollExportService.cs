using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Billing.Features.PayrollExports;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Entities;

namespace Pitbull.Billing.Services;

public class PayrollExportService(PitbullDbContext db, ILogger<PayrollExportService> logger) : IPayrollExportService
{
    public async Task<Result<ListPayrollExportsResult>> ListAsync(ListPayrollExportsQuery query, CancellationToken cancellationToken = default)
    {
        IQueryable<PayrollExport> dbQuery = db.Set<PayrollExport>()
            .AsNoTracking()
            .Include(x => x.Lines);

        if (query.PayrollRunId.HasValue)
            dbQuery = dbQuery.Where(x => x.PayrollRunId == query.PayrollRunId.Value);

        if (query.Format.HasValue)
            dbQuery = dbQuery.Where(x => x.Format == query.Format.Value);

        if (query.StartDate.HasValue)
        {
            DateTime from = query.StartDate.Value.ToDateTime(TimeOnly.MinValue);
            dbQuery = dbQuery.Where(x => x.ExportedAt >= from);
        }

        if (query.EndDate.HasValue)
        {
            DateTime toExclusive = query.EndDate.Value.AddDays(1).ToDateTime(TimeOnly.MinValue);
            dbQuery = dbQuery.Where(x => x.ExportedAt < toExclusive);
        }

        int totalCount = await dbQuery.CountAsync(cancellationToken);
        int page = query.Page < 1 ? 1 : query.Page;
        int pageSize = query.PageSize < 1 ? 25 : Math.Min(query.PageSize, 100);

        List<PayrollExport> items = await dbQuery
            .OrderByDescending(x => x.ExportedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        int totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        return Result.Success(new ListPayrollExportsResult(
            Items: items.Select(MapToDto).ToList(),
            TotalCount: totalCount,
            Page: page,
            PageSize: pageSize,
            TotalPages: totalPages));
    }

    public async Task<Result<PayrollExportDto>> GenerateAsync(GeneratePayrollExportCommand command, CancellationToken cancellationToken = default)
    {
        PayrollRun? run = await db.Set<PayrollRun>()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == command.PayrollRunId, cancellationToken);

        if (run is null)
            return Result.Failure<PayrollExportDto>("Payroll run not found", "NOT_FOUND");

        if (run.Status != PayrollRunStatus.Approved)
            return Result.Failure<PayrollExportDto>("Only approved payroll runs can be exported", "INVALID_STATUS");

        PayPeriod? payPeriod = await db.Set<PayPeriod>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == run.PayPeriodId, cancellationToken);

        if (payPeriod is null)
            return Result.Failure<PayrollExportDto>("Pay period not found for payroll run", "PAY_PERIOD_NOT_FOUND");

        List<TimeEntry> entries = await db.Set<TimeEntry>()
            .AsNoTracking()
            .Where(x => x.Status == TimeEntryStatus.Approved)
            .Where(x => x.Date >= payPeriod.StartDate && x.Date <= payPeriod.EndDate)
            .ToListAsync(cancellationToken);

        Dictionary<Guid, Employee> employeesById = await db.Set<Employee>()
            .AsNoTracking()
            .Where(x => run.Lines.Select(y => y.EmployeeId).Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        PayrollExport export = new()
        {
            PayrollRunId = run.Id,
            Format = command.Format,
            ExportedAt = DateTime.UtcNow,
            FileName = $"payroll-{run.RunDate:yyyyMMdd}-{command.Format.ToString().ToLowerInvariant()}.csv",
            FilePath = $"exports/payroll/{Guid.NewGuid():N}.csv"
        };

        foreach (PayrollRunLine line in run.Lines)
        {
            Employee employee = employeesById.GetValueOrDefault(line.EmployeeId) ?? new Employee
            {
                Id = line.EmployeeId,
                EmployeeNumber = $"EMP-{line.EmployeeId.ToString()[..8]}",
                FirstName = "Unknown",
                LastName = "Employee",
                BaseHourlyRate = 0m
            };

            List<TimeEntry> employeeEntries = entries.Where(x => x.EmployeeId == line.EmployeeId).ToList();
            if (employeeEntries.Count == 0)
            {
                employeeEntries.Add(new TimeEntry
                {
                    Id = Guid.NewGuid(),
                    EmployeeId = line.EmployeeId,
                    ProjectId = Guid.Empty,
                    CostCodeId = Guid.Empty,
                    RegularHours = line.RegularHours,
                    OvertimeHours = line.OvertimeHours,
                    DoubletimeHours = line.DoubletimeHours,
                    Date = run.RunDate,
                    Status = TimeEntryStatus.Approved
                });
            }

            decimal totalEntryHours = employeeEntries.Sum(x => x.RegularHours + x.OvertimeHours + x.DoubletimeHours);
            decimal deductions = decimal.Round(line.GrossPay * 0.20m, 2, MidpointRounding.AwayFromZero);
            decimal netPay = line.GrossPay - deductions;

            foreach (TimeEntry entry in employeeEntries)
            {
                decimal entryHours = entry.RegularHours + entry.OvertimeHours + entry.DoubletimeHours;
                decimal ratio = totalEntryHours <= 0 ? 0m : entryHours / totalEntryHours;
                decimal gross = decimal.Round(line.GrossPay * ratio, 2, MidpointRounding.AwayFromZero);
                decimal entryDeductions = decimal.Round(deductions * ratio, 2, MidpointRounding.AwayFromZero);
                decimal entryNet = gross - entryDeductions;

                export.Lines.Add(new PayrollExportLine
                {
                    EmployeeId = employee.Id,
                    EmployeeName = employee.FullName,
                    MaskedSsn = MaskSsn(employee.EmployeeNumber),
                    StraightTimeHours = entry.RegularHours,
                    OvertimeHours = entry.OvertimeHours,
                    DoubletimeHours = entry.DoubletimeHours,
                    HourlyRate = employee.BaseHourlyRate,
                    GrossPay = gross,
                    Deductions = entryDeductions,
                    NetPay = entryNet,
                    ProjectId = entry.ProjectId,
                    CostCodeId = entry.CostCodeId,
                    WorkClassificationId = null
                });
            }
        }

        db.Set<PayrollExport>().Add(export);
        run.Status = PayrollRunStatus.Exported;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(export));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to generate payroll export for payroll run {PayrollRunId}", command.PayrollRunId);
            return Result.Failure<PayrollExportDto>("Failed to generate payroll export", "DATABASE_ERROR");
        }
    }

    public async Task<Result<PayrollExportDownloadDto>> DownloadAsync(Guid exportId, CancellationToken cancellationToken = default)
    {
        PayrollExport? export = await db.Set<PayrollExport>()
            .AsNoTracking()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == exportId, cancellationToken);

        if (export is null)
            return Result.Failure<PayrollExportDownloadDto>("Payroll export not found", "NOT_FOUND");

        string csv = BuildCsv(export);

        return Result.Success(new PayrollExportDownloadDto(
            FileName: export.FileName,
            ContentType: "text/csv",
            Content: csv));
    }

    private static PayrollExportDto MapToDto(PayrollExport export)
    {
        return new PayrollExportDto(
            Id: export.Id,
            PayrollRunId: export.PayrollRunId,
            Format: export.Format,
            FormatName: export.Format.ToString(),
            ExportedAt: export.ExportedAt,
            FilePath: export.FilePath,
            FileName: export.FileName,
            LineCount: export.Lines.Count,
            TotalGross: export.Lines.Sum(x => x.GrossPay),
            TotalNet: export.Lines.Sum(x => x.NetPay),
            CreatedAt: export.CreatedAt,
            UpdatedAt: export.UpdatedAt);
    }

    private static string BuildCsv(PayrollExport export)
    {
        StringBuilder sb = new();
        sb.AppendLine("Employee ID,Name,SSN,Hours ST,Hours OT,Hours DT,Rate,Gross,Deductions,Net,Project,Cost Code,Classification");

        foreach (PayrollExportLine line in export.Lines)
        {
            sb.AppendLine(string.Join(',',
                line.EmployeeId,
                EscapeCsv(line.EmployeeName),
                line.MaskedSsn,
                line.StraightTimeHours.ToString("0.##"),
                line.OvertimeHours.ToString("0.##"),
                line.DoubletimeHours.ToString("0.##"),
                line.HourlyRate.ToString("0.00"),
                line.GrossPay.ToString("0.00"),
                line.Deductions.ToString("0.00"),
                line.NetPay.ToString("0.00"),
                line.ProjectId,
                line.CostCodeId,
                line.WorkClassificationId?.ToString() ?? string.Empty));
        }

        return sb.ToString();
    }

    private static string EscapeCsv(string value)
    {
        if (value.Contains(',') || value.Contains('"'))
            return $"\"{value.Replace("\"", "\"\"")}\"";

        return value;
    }

    private static string MaskSsn(string seed)
    {
        string digits = new(seed.Where(char.IsDigit).ToArray());
        string last4 = digits.Length >= 4 ? digits[^4..] : digits.PadLeft(4, '0');
        return $"***-**-{last4}";
    }
}
