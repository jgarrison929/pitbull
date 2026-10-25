using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Billing.Features.CertifiedPayroll;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Entities;

namespace Pitbull.Billing.Services;

public class CertifiedPayrollService(PitbullDbContext db, ILogger<CertifiedPayrollService> logger) : ICertifiedPayrollService
{
    public async Task<Result<ListCertifiedPayrollReportsResult>> ListAsync(ListCertifiedPayrollReportsQuery query, CancellationToken cancellationToken = default)
    {
        IQueryable<CertifiedPayrollReport> dbQuery = db.Set<CertifiedPayrollReport>().AsNoTracking();

        if (query.PayrollRunId.HasValue)
            dbQuery = dbQuery.Where(x => x.PayrollRunId == query.PayrollRunId.Value);

        if (query.ProjectId.HasValue)
            dbQuery = dbQuery.Where(x => x.ProjectId == query.ProjectId.Value);

        if (query.Status.HasValue)
            dbQuery = dbQuery.Where(x => x.Status == query.Status.Value);

        int totalCount = await dbQuery.CountAsync(cancellationToken);
        int page = query.Page < 1 ? 1 : query.Page;
        int pageSize = query.PageSize < 1 ? 25 : Math.Min(query.PageSize, 100);

        List<CertifiedPayrollReport> items = await dbQuery
            .OrderByDescending(x => x.WeekEnding)
            .ThenByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        int totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        return Result.Success(new ListCertifiedPayrollReportsResult(
            Items: items.Select(MapReportDto).ToList(),
            TotalCount: totalCount,
            Page: page,
            PageSize: pageSize,
            TotalPages: totalPages));
    }

    public async Task<Result<CertifiedPayrollGenerateResult>> GenerateAsync(GenerateCertifiedPayrollCommand command, CancellationToken cancellationToken = default)
    {
        PayrollRun? run = await db.Set<PayrollRun>()
            .AsNoTracking()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == command.PayrollRunId, cancellationToken);

        if (run is null)
            return Result.Failure<CertifiedPayrollGenerateResult>("Payroll run not found", "PAYROLL_RUN_NOT_FOUND");

        PayPeriod? payPeriod = await db.Set<PayPeriod>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == run.PayPeriodId, cancellationToken);

        if (payPeriod is null)
            return Result.Failure<CertifiedPayrollGenerateResult>("Pay period not found", "PAY_PERIOD_NOT_FOUND");

        bool exists = await db.Set<CertifiedPayrollReport>()
            .AnyAsync(x => x.PayrollRunId == command.PayrollRunId
                && x.ProjectId == command.ProjectId
                && x.WeekEnding == command.WeekEnding,
                cancellationToken);

        if (exists)
            return Result.Failure<CertifiedPayrollGenerateResult>("Certified payroll report already exists for this run/project/week", "DUPLICATE_REPORT");

        List<TimeEntry> approvedProjectEntries = await db.Set<TimeEntry>()
            .AsNoTracking()
            .Where(x => x.Status == TimeEntryStatus.Approved)
            .Where(x => x.ProjectId == command.ProjectId)
            .Where(x => x.Date >= payPeriod.StartDate && x.Date <= payPeriod.EndDate)
            .ToListAsync(cancellationToken);

        if (approvedProjectEntries.Count == 0)
            return Result.Failure<CertifiedPayrollGenerateResult>("No approved project time entries found for this payroll run period", "NO_PROJECT_TIME_ENTRIES");

        Dictionary<Guid, PayrollRunLine> runLineByEmployee = run.Lines
            .GroupBy(x => x.EmployeeId)
            .Select(x => x.First())
            .ToDictionary(x => x.EmployeeId, x => x);

        List<CertifiedPayrollLineDto> lines = [];
        foreach (IGrouping<Guid, TimeEntry> employeeGroup in approvedProjectEntries.GroupBy(x => x.EmployeeId))
        {
            if (!runLineByEmployee.TryGetValue(employeeGroup.Key, out PayrollRunLine? runLine))
                continue;

            decimal regularHours = employeeGroup.Sum(x => x.RegularHours);
            decimal overtimeHours = employeeGroup.Sum(x => x.OvertimeHours);
            decimal doubletimeHours = employeeGroup.Sum(x => x.DoubletimeHours);

            decimal regularRate = runLine.RegularHours > 0 ? runLine.RegularPay / runLine.RegularHours : 0m;
            decimal overtimeRate = runLine.OvertimeHours > 0 ? runLine.OvertimePay / runLine.OvertimeHours : regularRate * 1.5m;
            decimal doubletimeRate = runLine.DoubletimeHours > 0 ? runLine.DoubletimePay / runLine.DoubletimeHours : regularRate * 2.0m;

            decimal gross = decimal.Round(
                (regularHours * regularRate) +
                (overtimeHours * overtimeRate) +
                (doubletimeHours * doubletimeRate),
                2,
                MidpointRounding.AwayFromZero);

            lines.Add(new CertifiedPayrollLineDto(
                EmployeeId: employeeGroup.Key,
                RegularHours: regularHours,
                OvertimeHours: overtimeHours,
                DoubletimeHours: doubletimeHours,
                GrossPay: gross));
        }

        if (lines.Count == 0)
            return Result.Failure<CertifiedPayrollGenerateResult>("No payroll lines matched project entries", "NO_PAYROLL_LINES");

        CertifiedPayrollReport report = new()
        {
            PayrollRunId = command.PayrollRunId,
            ProjectId = command.ProjectId,
            WeekEnding = command.WeekEnding,
            WHDFormNumber = "WH-347",
            Status = CertifiedPayrollStatus.Draft
        };

        db.Set<CertifiedPayrollReport>().Add(report);

        try
        {
            await db.SaveChangesAsync(cancellationToken);

            decimal totalGross = lines.Sum(x => x.GrossPay);
            return Result.Success(new CertifiedPayrollGenerateResult(
                Report: MapReportDto(report),
                Lines: lines,
                TotalGross: totalGross));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to generate certified payroll for payroll run {PayrollRunId}", command.PayrollRunId);
            return Result.Failure<CertifiedPayrollGenerateResult>("Failed to generate certified payroll", "DATABASE_ERROR");
        }
    }

    private static CertifiedPayrollReportDto MapReportDto(CertifiedPayrollReport report)
    {
        return new CertifiedPayrollReportDto(
            Id: report.Id,
            PayrollRunId: report.PayrollRunId,
            ProjectId: report.ProjectId,
            WeekEnding: report.WeekEnding,
            WHDFormNumber: report.WHDFormNumber,
            Status: report.Status,
            StatusName: report.Status.ToString(),
            CreatedAt: report.CreatedAt,
            UpdatedAt: report.UpdatedAt);
    }
}
