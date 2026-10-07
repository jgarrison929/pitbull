using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Payroll.Features.PayrollExports;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Payroll.Domain;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Payroll.Services;

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
            .Include(x => x.PaySlips)
            .ThenInclude(s => s.Lines)
            .FirstOrDefaultAsync(x => x.Id == command.PayrollRunId, cancellationToken);

        if (run is null)
            return Result.Failure<PayrollExportDto>("Payroll run not found", "NOT_FOUND");

        if (run.Status is not (PayrollRunStatus.Approved or PayrollRunStatus.Posted))
            return Result.Failure<PayrollExportDto>("Only approved payroll runs can be exported", "INVALID_STATUS");

        if (run.PaySlips.Count == 0 || run.PaySlips.All(s => s.Lines.Count == 0))
        {
            return Result.Failure<PayrollExportDto>(
                "Cannot export: payroll run has no job-costed pay slip lines. Generate the run after P3 so project and cost code stay on the line.",
                "NO_PAY_SLIP_LINES");
        }

        Dictionary<Guid, Employee> employeesById = await db.Set<Employee>()
            .AsNoTracking()
            .Where(x => run.PaySlips.Select(y => y.EmployeeId).Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        PayrollExport export = new()
        {
            PayrollRunId = run.Id,
            Format = command.Format,
            ExportedAt = DateTime.UtcNow,
            FileName = $"payroll-{run.RunDate:yyyyMMdd}-{command.Format.ToString().ToLowerInvariant()}.csv",
            FilePath = $"exports/payroll/{Guid.NewGuid():N}.csv"
        };

        foreach (PaySlip slip in run.PaySlips)
        {
            Employee employee = employeesById.GetValueOrDefault(slip.EmployeeId) ?? new Employee
            {
                Id = slip.EmployeeId,
                EmployeeNumber = $"EMP-{slip.EmployeeId.ToString()[..8]}",
                FirstName = "Unknown",
                LastName = "Employee",
                BaseHourlyRate = 0m
            };

            var jobGroups = slip.Lines
                .Where(l => l.Kind == PayComponentKind.Earning)
                .GroupBy(l => (l.ProjectId, l.CostCodeId, l.WorkClassificationId));

            decimal slipGross = slip.Lines.Where(l => l.Kind == PayComponentKind.Earning).Sum(l => l.Amount);
            decimal slipDeductions = slip.TotalDeductions + slip.TotalTaxes;
            if (slipDeductions == 0m && slip.Gross > slip.Net)
                slipDeductions = slip.Gross - slip.Net;

            foreach (var job in jobGroups)
            {
                decimal stHours = job.Where(l => l.ComponentCode == "ST").Sum(l => l.Hours);
                decimal otHours = job.Where(l => l.ComponentCode == "OT").Sum(l => l.Hours);
                decimal dtHours = job.Where(l => l.ComponentCode == "DT").Sum(l => l.Hours);
                decimal gross = job.Sum(l => l.Amount);
                decimal rate = stHours > 0m
                    ? job.Where(l => l.ComponentCode == "ST").Select(l => l.Rate).FirstOrDefault()
                    : job.Select(l => l.Rate).FirstOrDefault();
                decimal deductions = slipGross <= 0m
                    ? 0m
                    : decimal.Round(slipDeductions * (gross / slipGross), 2, MidpointRounding.AwayFromZero);

                export.Lines.Add(new PayrollExportLine
                {
                    EmployeeId = employee.Id,
                    EmployeeName = employee.FullName,
                    MaskedSsn = MaskSsn(employee.EmployeeNumber),
                    StraightTimeHours = stHours,
                    OvertimeHours = otHours,
                    DoubletimeHours = dtHours,
                    HourlyRate = rate,
                    GrossPay = gross,
                    Deductions = deductions,
                    NetPay = gross - deductions,
                    ProjectId = job.Key.ProjectId,
                    CostCodeId = job.Key.CostCodeId,
                    WorkClassificationId = job.Key.WorkClassificationId
                });
            }
        }

        if (export.Lines.Count == 0)
        {
            logger.LogError("Payroll export aborted: run {PayrollRunId} has pay slips but no earning lines", command.PayrollRunId);
            return Result.Failure<PayrollExportDto>(
                "Cannot export: pay slips have no earning lines with project and cost code.",
                "NO_PAY_SLIP_LINES");
        }

        db.Set<PayrollExport>().Add(export);
        if (run.Status != PayrollRunStatus.Posted)
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
