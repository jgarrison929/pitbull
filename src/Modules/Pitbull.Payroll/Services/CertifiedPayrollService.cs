using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Payroll.Features.CertifiedPayroll;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Entities;

namespace Pitbull.Payroll.Services;

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

    public async Task<Result<CertifiedPayrollReportDetailDto>> GetAsync(Guid id, CancellationToken cancellationToken = default)
    {
        CertifiedPayrollReport? report = await db.Set<CertifiedPayrollReport>()
            .AsNoTracking()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (report is null)
            return Result.Failure<CertifiedPayrollReportDetailDto>("Certified payroll report not found", "NOT_FOUND");

        List<CertifiedPayrollLineDto> lines = await MapStoredLinesAsync(report, cancellationToken);
        return Result.Success(new CertifiedPayrollReportDetailDto(
            Report: MapReportDto(report),
            Lines: lines,
            TotalGross: lines.Sum(x => x.GrossPay)));
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

        Project? project = await db.Set<Project>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == command.ProjectId, cancellationToken);

        if (project is null)
            return Result.Failure<CertifiedPayrollGenerateResult>("Project not found", "PROJECT_NOT_FOUND");

        if (!project.CertifiedPayroll)
            return Result.Failure<CertifiedPayrollGenerateResult>(
                "Certified payroll can only be generated for projects with CertifiedPayroll enabled",
                "PROJECT_NOT_CERTIFIED");

        CertifiedPayrollReport? existing = await db.Set<CertifiedPayrollReport>()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.PayrollRunId == command.PayrollRunId
                && x.ProjectId == command.ProjectId
                && x.WeekEnding == command.WeekEnding,
                cancellationToken);

        if (existing is not null && existing.Status != CertifiedPayrollStatus.Draft)
            return Result.Failure<CertifiedPayrollGenerateResult>(
                "Submitted certified payroll reports are immutable",
                "REPORT_IMMUTABLE");

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

        List<FringeBenefitAllocation> allocations = await db.Set<FringeBenefitAllocation>()
            .AsNoTracking()
            .Where(x => x.ProjectId == command.ProjectId)
            .Where(x => runLineByEmployee.Keys.Contains(x.EmployeeId))
            .ToListAsync(cancellationToken);

        List<(Guid EmployeeId, Guid? ClassId, decimal RegularHours, decimal OvertimeHours, decimal DoubletimeHours, PayrollRunLine RunLine)> built = [];
        foreach (IGrouping<(Guid EmployeeId, Guid? ClassId), TimeEntry> group in approvedProjectEntries
            .GroupBy(x =>
            {
                runLineByEmployee.TryGetValue(x.EmployeeId, out PayrollRunLine? line);
                Guid? classId = x.WorkClassificationId ?? line?.WorkClassificationId;
                return (x.EmployeeId, classId);
            }))
        {
            if (!runLineByEmployee.TryGetValue(group.Key.EmployeeId, out PayrollRunLine? runLine))
                continue;

            built.Add((
                group.Key.EmployeeId,
                group.Key.ClassId,
                group.Sum(x => x.RegularHours),
                group.Sum(x => x.OvertimeHours),
                group.Sum(x => x.DoubletimeHours),
                runLine));
        }

        if (built.Count == 0)
            return Result.Failure<CertifiedPayrollGenerateResult>("No payroll lines matched project entries", "NO_PAYROLL_LINES");

        CertifiedPayrollReport report = existing ?? new CertifiedPayrollReport
        {
            PayrollRunId = command.PayrollRunId,
            ProjectId = command.ProjectId,
            WeekEnding = command.WeekEnding,
            WHDFormNumber = "WH-347",
            Status = CertifiedPayrollStatus.Draft
        };

        if (existing is not null)
        {
            db.Set<CertifiedPayrollLine>().RemoveRange(existing.Lines);
            existing.Lines.Clear();
            existing.WeekEnding = command.WeekEnding;
            existing.WHDFormNumber = "WH-347";
        }
        else
        {
            db.Set<CertifiedPayrollReport>().Add(report);
        }

        foreach ((Guid employeeId, Guid? classId, decimal regularHours, decimal overtimeHours, decimal doubletimeHours, PayrollRunLine runLine) in built)
        {
            decimal regularRate = runLine.RegularHours > 0 ? runLine.RegularPay / runLine.RegularHours : 0m;
            decimal overtimeRate = runLine.OvertimeHours > 0 ? runLine.OvertimePay / runLine.OvertimeHours : regularRate * 1.5m;
            decimal doubletimeRate = runLine.DoubletimeHours > 0 ? runLine.DoubletimePay / runLine.DoubletimeHours : regularRate * 2.0m;

            decimal gross = decimal.Round(
                (regularHours * regularRate) +
                (overtimeHours * overtimeRate) +
                (doubletimeHours * doubletimeRate),
                2,
                MidpointRounding.AwayFromZero);

            decimal totalHours = regularHours + overtimeHours + doubletimeHours;
            (decimal cashFringe, decimal benefitFringe) = ResolveFringe(
                allocations,
                employeeId,
                command.ProjectId,
                runLine.Id,
                totalHours);

            decimal deductions = 0m;
            decimal net = decimal.Round(gross + cashFringe - deductions, 2, MidpointRounding.AwayFromZero);

            report.Lines.Add(new CertifiedPayrollLine
            {
                EmployeeId = employeeId,
                WorkClassificationId = classId,
                ProjectId = command.ProjectId,
                PayrollRunLineId = runLine.Id,
                RegularHours = regularHours,
                OvertimeHours = overtimeHours,
                DoubletimeHours = doubletimeHours,
                RegularRate = decimal.Round(regularRate, 4, MidpointRounding.AwayFromZero),
                OvertimeRate = decimal.Round(overtimeRate, 4, MidpointRounding.AwayFromZero),
                DoubletimeRate = decimal.Round(doubletimeRate, 4, MidpointRounding.AwayFromZero),
                GrossPay = gross,
                CashFringe = cashFringe,
                BenefitFringe = benefitFringe,
                Deductions = deductions,
                NetPay = net
            });
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);

            CertifiedPayrollReport stored = await db.Set<CertifiedPayrollReport>()
                .AsNoTracking()
                .Include(x => x.Lines)
                .FirstAsync(x => x.Id == report.Id, cancellationToken);

            List<CertifiedPayrollLineDto> lines = await MapStoredLinesAsync(stored, cancellationToken);
            return Result.Success(new CertifiedPayrollGenerateResult(
                Report: MapReportDto(stored),
                Lines: lines,
                TotalGross: lines.Sum(x => x.GrossPay)));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to generate certified payroll for payroll run {PayrollRunId}", command.PayrollRunId);
            return Result.Failure<CertifiedPayrollGenerateResult>("Failed to generate certified payroll", "DATABASE_ERROR");
        }
    }

    public async Task<Result<CertifiedPayrollReportDto>> SaveStatementAsync(SaveCertifiedPayrollStatementCommand command, CancellationToken cancellationToken = default)
    {
        CertifiedPayrollReport? report = await db.Set<CertifiedPayrollReport>()
            .FirstOrDefaultAsync(x => x.Id == command.ReportId, cancellationToken);

        if (report is null)
            return Result.Failure<CertifiedPayrollReportDto>("Certified payroll report not found", "NOT_FOUND");

        if (report.Status != CertifiedPayrollStatus.Draft)
            return Result.Failure<CertifiedPayrollReportDto>("Submitted certified payroll reports are immutable", "REPORT_IMMUTABLE");

        string signerName = (command.SignerName ?? string.Empty).Trim();
        string signerTitle = (command.SignerTitle ?? string.Empty).Trim();
        string fringeStatement = (command.FringeBenefitStatement ?? string.Empty).Trim();

        if (signerName.Length == 0)
            return Result.Failure<CertifiedPayrollReportDto>("Signer name is required", "STATEMENT_INCOMPLETE");
        if (signerTitle.Length == 0)
            return Result.Failure<CertifiedPayrollReportDto>("Signer title is required", "STATEMENT_INCOMPLETE");
        if (fringeStatement.Length == 0)
            return Result.Failure<CertifiedPayrollReportDto>("Fringe-benefit statement is required", "STATEMENT_INCOMPLETE");

        report.SignerName = signerName;
        report.SignerTitle = signerTitle;
        report.FringeBenefitStatement = fringeStatement;
        report.ExceptionsRemarks = string.IsNullOrWhiteSpace(command.ExceptionsRemarks) ? null : command.ExceptionsRemarks.Trim();
        if (!string.IsNullOrWhiteSpace(command.SignedByUserId))
            report.SignedByUserId = command.SignedByUserId.Trim();

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapReportDto(report));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to save statement of compliance for report {ReportId}", command.ReportId);
            return Result.Failure<CertifiedPayrollReportDto>("Failed to save statement of compliance", "DATABASE_ERROR");
        }
    }

    public async Task<Result<CertifiedPayrollReportDto>> SubmitAsync(SubmitCertifiedPayrollCommand command, CancellationToken cancellationToken = default)
    {
        CertifiedPayrollReport? report = await db.Set<CertifiedPayrollReport>()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == command.ReportId, cancellationToken);

        if (report is null)
            return Result.Failure<CertifiedPayrollReportDto>("Certified payroll report not found", "NOT_FOUND");

        if (report.Status != CertifiedPayrollStatus.Draft)
            return Result.Failure<CertifiedPayrollReportDto>("Certified payroll report is already submitted", "INVALID_STATUS");

        if (string.IsNullOrWhiteSpace(report.SignerName)
            || string.IsNullOrWhiteSpace(report.SignerTitle)
            || string.IsNullOrWhiteSpace(report.FringeBenefitStatement))
        {
            return Result.Failure<CertifiedPayrollReportDto>(
                "Statement of Compliance fields are required before submit",
                "STATEMENT_INCOMPLETE");
        }

        if (report.Lines.Count == 0)
            return Result.Failure<CertifiedPayrollReportDto>("Certified payroll report has no stored lines", "NO_PAYROLL_LINES");

        report.Status = CertifiedPayrollStatus.Submitted;
        report.SignedAt = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(command.SignedByUserId))
            report.SignedByUserId = command.SignedByUserId.Trim();

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapReportDto(report));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to submit certified payroll report {ReportId}", command.ReportId);
            return Result.Failure<CertifiedPayrollReportDto>("Failed to submit certified payroll report", "DATABASE_ERROR");
        }
    }

    private async Task<List<CertifiedPayrollLineDto>> MapStoredLinesAsync(CertifiedPayrollReport report, CancellationToken cancellationToken)
    {
        List<Guid> classIds = report.Lines
            .Where(x => x.WorkClassificationId.HasValue)
            .Select(x => x.WorkClassificationId!.Value)
            .Distinct()
            .ToList();

        Dictionary<Guid, WorkClassification> classes = classIds.Count == 0
            ? []
            : await db.Set<WorkClassification>()
                .AsNoTracking()
                .Where(x => classIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);

        return report.Lines
            .OrderBy(x => x.EmployeeId)
            .ThenBy(x => x.WorkClassificationId)
            .Select(line =>
            {
                WorkClassification? wc = line.WorkClassificationId.HasValue
                    ? classes.GetValueOrDefault(line.WorkClassificationId.Value)
                    : null;
                return MapLineDto(line, wc);
            })
            .ToList();
    }

    private static (decimal Cash, decimal Benefit) ResolveFringe(
        List<FringeBenefitAllocation> allocations,
        Guid employeeId,
        Guid projectId,
        Guid payrollRunLineId,
        decimal totalHours)
    {
        FringeBenefitAllocation? alloc = allocations
            .Where(x => x.EmployeeId == employeeId && x.ProjectId == projectId)
            .OrderByDescending(x => x.PayrollRunLineId == payrollRunLineId)
            .FirstOrDefault();

        if (alloc is null)
            return (0m, 0m);

        if (alloc.CashFringeAmount != 0m || alloc.BenefitFringeAmount != 0m)
        {
            return (
                decimal.Round(alloc.CashFringeAmount, 2, MidpointRounding.AwayFromZero),
                decimal.Round(alloc.BenefitFringeAmount, 2, MidpointRounding.AwayFromZero));
        }

        decimal required = decimal.Round(alloc.RequiredFringeRate * totalHours, 2, MidpointRounding.AwayFromZero);
        return alloc.AllocationMethod switch
        {
            FringeAllocationMethod.Cash => (required, 0m),
            FringeAllocationMethod.Benefits => (0m, required),
            FringeAllocationMethod.Split => (0m, 0m),
            _ => (0m, 0m)
        };
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
            UpdatedAt: report.UpdatedAt,
            SignerName: report.SignerName,
            SignerTitle: report.SignerTitle,
            SignedAt: report.SignedAt,
            SignedByUserId: report.SignedByUserId,
            ExceptionsRemarks: report.ExceptionsRemarks,
            FringeBenefitStatement: report.FringeBenefitStatement);
    }

    private static CertifiedPayrollLineDto MapLineDto(CertifiedPayrollLine line, WorkClassification? classification)
    {
        string? className = classification is null
            ? null
            : string.IsNullOrWhiteSpace(classification.ClassName)
                ? classification.Name
                : classification.ClassName;

        return new CertifiedPayrollLineDto(
            EmployeeId: line.EmployeeId,
            RegularHours: line.RegularHours,
            OvertimeHours: line.OvertimeHours,
            DoubletimeHours: line.DoubletimeHours,
            GrossPay: line.GrossPay,
            Id: line.Id,
            WorkClassificationId: line.WorkClassificationId,
            WorkClassificationCode: classification?.Code,
            WorkClassificationName: className,
            ProjectId: line.ProjectId,
            RegularRate: line.RegularRate,
            OvertimeRate: line.OvertimeRate,
            DoubletimeRate: line.DoubletimeRate,
            CashFringe: line.CashFringe,
            BenefitFringe: line.BenefitFringe,
            Deductions: line.Deductions,
            NetPay: line.NetPay);
    }
}
