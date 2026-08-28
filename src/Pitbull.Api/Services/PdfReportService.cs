using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.ProjectManagement.Domain;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Entities;

namespace Pitbull.Api.Services;

public interface IPdfReportService
{
    Task<byte[]> GenerateWipSchedulePdfAsync(CancellationToken cancellationToken = default);
    Task<byte[]> GenerateProjectCostSummaryPdfAsync(Guid projectId, CancellationToken cancellationToken = default);
    Task<byte[]> GenerateRetentionSummaryPdfAsync(CancellationToken cancellationToken = default);
    Task<byte[]> GenerateWh347PdfAsync(Guid payrollRunId, CancellationToken cancellationToken = default);
    Task<byte[]> GenerateAgedArPdfAsync(CancellationToken cancellationToken = default);
    Task<byte[]> GenerateSubmittalLogPdfAsync(Guid projectId, CancellationToken cancellationToken = default);
    Task<byte[]> GeneratePunchListPdfAsync(Guid projectId, CancellationToken cancellationToken = default);
}

public sealed class PdfReportService(
    PitbullDbContext db,
    ITenantContext tenantContext,
    ICompanyContext companyContext,
    ILogger<PdfReportService> logger) : IPdfReportService
{
    internal async Task<(List<WipLineRow> Lines, DateTime ReportDate)> AssembleWipScheduleDataAsync(CancellationToken cancellationToken = default)
    {
        var report = await db.Set<WipReport>()
            .AsNoTracking()
            .OrderByDescending(x => x.ReportDate)
            .ThenByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        var lines = new List<WipLineRow>();
        if (report is not null)
        {
            var rawLines = await db.Set<WipReportLine>()
                .AsNoTracking()
                .Where(x => x.WipReportId == report.Id)
                .ToListAsync(cancellationToken);

            var projectIds = rawLines.Select(x => x.ProjectId).Distinct().ToList();
            var projectMap = await db.Set<Project>()
                .AsNoTracking()
                .Where(p => projectIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, cancellationToken);

            lines = rawLines
                .Select(line =>
                {
                    projectMap.TryGetValue(line.ProjectId, out var project);
                    return new WipLineRow(
                        ProjectName: project?.Name ?? "Unknown Project",
                        ContractAmount: line.RevisedContractAmount,
                        CostsToDate: line.TotalCostToDate,
                        EstimatedTotalCost: line.EstimatedTotalCost,
                        PercentComplete: line.PercentComplete,
                        EarnedRevenue: line.EarnedRevenue,
                        BilledToDate: line.BilledToDate,
                        OverUnderBilling: line.OverUnderBilling);
                })
                .OrderBy(x => x.ProjectName)
                .ToList();
        }

        var reportDate = report?.ReportDate.ToDateTime(TimeOnly.MinValue) ?? DateTime.UtcNow.Date;
        return (lines, reportDate);
    }

    public async Task<byte[]> GenerateWipSchedulePdfAsync(CancellationToken cancellationToken = default)
    {
        logger.LogInformation("Generating WIP Schedule PDF for tenant {TenantId}", tenantContext.TenantId);
        var (lines, reportDate) = await AssembleWipScheduleDataAsync(cancellationToken);
        return BuildSimpleTablePdf(
            "WIP Schedule",
            reportDate,
            ["Project", "Contract Value", "Costs to Date", "Est Total Cost", "% Complete", "Earned Revenue", "Billings to Date", "Over/(Under)"],
            lines.Select(x => new[]
            {
                x.ProjectName,
                Money(x.ContractAmount),
                Money(x.CostsToDate),
                Money(x.EstimatedTotalCost),
                $"{x.PercentComplete:N1}%",
                Money(x.EarnedRevenue),
                Money(x.BilledToDate),
                Money(x.OverUnderBilling)
            }).ToList(),
            new[]
            {
                "TOTAL",
                Money(lines.Sum(x => x.ContractAmount)),
                Money(lines.Sum(x => x.CostsToDate)),
                Money(lines.Sum(x => x.EstimatedTotalCost)),
                string.Empty,
                Money(lines.Sum(x => x.EarnedRevenue)),
                Money(lines.Sum(x => x.BilledToDate)),
                Money(lines.Sum(x => x.OverUnderBilling))
            });
    }

    public async Task<byte[]> GenerateProjectCostSummaryPdfAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        logger.LogInformation("Generating Project Cost Summary PDF for project {ProjectId}", projectId);
        var project = await db.Set<Project>().AsNoTracking().FirstOrDefaultAsync(x => x.Id == projectId, cancellationToken);
        if (project is null)
            throw new KeyNotFoundException("Project not found");

        var budgets = await db.Set<PmJobCostBudget>()
            .AsNoTracking()
            .Where(x => x.ProjectId == projectId)
            .ToListAsync(cancellationToken);

        var actualsByCostCode = await db.Set<PmJobCostActual>()
            .AsNoTracking()
            .Where(x => x.ProjectId == projectId)
            .GroupBy(x => x.CostCodeId)
            .Select(g => new { CostCodeId = g.Key, Total = g.Sum(x => x.TotalActualCost) })
            .ToDictionaryAsync(x => x.CostCodeId, x => x.Total, cancellationToken);

        var commitmentsByCostCode = await db.Set<PmJobCostCommitment>()
            .AsNoTracking()
            .Where(x => x.ProjectId == projectId)
            .GroupBy(x => x.CostCodeId)
            .Select(g => new { CostCodeId = g.Key, Total = g.Sum(x => x.CurrentCommittedAmount) })
            .ToDictionaryAsync(x => x.CostCodeId, x => x.Total, cancellationToken);

        var costCodeIds = budgets.Select(x => x.CostCodeId).Distinct().ToList();
        var costCodes = await db.Set<CostCode>()
            .AsNoTracking()
            .Where(x => costCodeIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var rows = budgets.Select(budget =>
        {
            actualsByCostCode.TryGetValue(budget.CostCodeId, out var actual);
            commitmentsByCostCode.TryGetValue(budget.CostCodeId, out var committed);
            costCodes.TryGetValue(budget.CostCodeId, out var costCode);

            var variance = budget.CurrentBudget - actual - committed;
            var spentPercent = budget.CurrentBudget <= 0m ? 0m : ((actual + committed) / budget.CurrentBudget) * 100m;
            return new ProjectCostRow(
                CostCode: costCode?.Code ?? "N/A",
                Description: costCode?.Description ?? string.Empty,
                Budget: budget.CurrentBudget,
                Actual: actual,
                Committed: committed,
                Variance: variance,
                PercentSpent: spentPercent);
        }).OrderBy(x => x.CostCode).ToList();

        return BuildSimpleTablePdf(
            $"Project Cost Summary - {project.Name}",
            DateTime.UtcNow,
            ["Cost Code", "Description", "Budget", "Actual", "Committed", "Variance", "% Spent"],
            rows.Select(x => new[]
            {
                x.CostCode,
                x.Description,
                Money(x.Budget),
                Money(x.Actual),
                Money(x.Committed),
                Money(x.Variance),
                $"{x.PercentSpent:N1}%"
            }).ToList(),
            new[]
            {
                "TOTAL",
                string.Empty,
                Money(rows.Sum(x => x.Budget)),
                Money(rows.Sum(x => x.Actual)),
                Money(rows.Sum(x => x.Committed)),
                Money(rows.Sum(x => x.Variance)),
                string.Empty
            });
    }

    public async Task<byte[]> GenerateRetentionSummaryPdfAsync(CancellationToken cancellationToken = default)
    {
        logger.LogInformation("Generating Retention Summary PDF for tenant {TenantId}", tenantContext.TenantId);
        var holds = await db.Set<RetentionHold>()
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var projectMap = await db.Set<Project>()
            .AsNoTracking()
            .Where(x => holds.Select(h => h.ProjectId).Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var rows = holds.Select(hold =>
        {
            projectMap.TryGetValue(hold.ProjectId, out var project);
            var balance = hold.RetainedAmount - hold.ReleasedAmount;
            return new RetentionSummaryRow(
                ProjectName: project?.Name ?? "Unknown Project",
                ContractAmount: hold.OriginalAmount,
                RetentionHeld: hold.RetainedAmount,
                RetentionReleased: hold.ReleasedAmount,
                Balance: balance);
        }).OrderBy(x => x.ProjectName).ToList();

        return BuildSimpleTablePdf(
            "Retention Summary",
            DateTime.UtcNow,
            ["Project", "Contract Amount", "Retention Held", "Retention Released", "Balance"],
            rows.Select(x => new[]
            {
                x.ProjectName,
                Money(x.ContractAmount),
                Money(x.RetentionHeld),
                Money(x.RetentionReleased),
                Money(x.Balance)
            }).ToList(),
            new[]
            {
                "TOTAL",
                Money(rows.Sum(x => x.ContractAmount)),
                Money(rows.Sum(x => x.RetentionHeld)),
                Money(rows.Sum(x => x.RetentionReleased)),
                Money(rows.Sum(x => x.Balance))
            });
    }

    public async Task<byte[]> GenerateWh347PdfAsync(Guid payrollRunId, CancellationToken cancellationToken = default)
    {
        logger.LogInformation("Generating WH-347 PDF for payroll run {PayrollRunId}", payrollRunId);
        var run = await db.Set<PayrollRun>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == payrollRunId, cancellationToken);

        if (run is null)
            throw new KeyNotFoundException("Payroll run not found");

        var lines = await db.Set<PayrollRunLine>()
            .AsNoTracking()
            .Where(x => x.PayrollRunId == payrollRunId)
            .ToListAsync(cancellationToken);

        var employeeIds = lines.Select(l => l.EmployeeId).Distinct().ToList();
        var employeeMap = await db.Set<Employee>()
            .AsNoTracking()
            .Where(x => employeeIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var certifiedReport = await db.Set<CertifiedPayrollReport>()
            .AsNoTracking()
            .Where(x => x.PayrollRunId == payrollRunId)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        var projectName = "N/A";
        var projectLocation = "";
        var contractNumber = "";
        DateOnly? weekEnding = null;
        if (certifiedReport is not null)
        {
            var project = await db.Set<Project>()
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == certifiedReport.ProjectId, cancellationToken);
            projectName = project?.Name ?? "N/A";
            projectLocation = project?.Address ?? "";
            contractNumber = project?.Number ?? "";
            weekEnding = certifiedReport.WeekEnding;
        }

        var payPeriod = await db.Set<PayPeriod>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == run.PayPeriodId, cancellationToken);

        // Query time entries for daily hour breakdown
        var timeEntries = new List<TimeEntry>();
        if (payPeriod is not null)
        {
            timeEntries = await db.Set<TimeEntry>()
                .AsNoTracking()
                .Where(x => employeeIds.Contains(x.EmployeeId))
                .Where(x => x.Date >= payPeriod.StartDate && x.Date <= payPeriod.EndDate)
                .ToListAsync(cancellationToken);
        }

        // Build daily hours lookup: EmployeeId -> DayOfWeek -> total hours
        var dailyHoursLookup = timeEntries
            .GroupBy(x => x.EmployeeId)
            .ToDictionary(
                g => g.Key,
                g => g.GroupBy(te => te.Date.DayOfWeek)
                      .ToDictionary(dg => dg.Key, dg => dg.Sum(te => te.RegularHours + te.OvertimeHours + te.DoubletimeHours)));

        // Get company info
        var companyName = GetCompanyName();
        var company = await db.Set<Company>()
            .AsNoTracking()
            .Where(x => x.Id == companyContext.CompanyId)
            .FirstOrDefaultAsync(cancellationToken);

        var companyAddress = company is not null
            ? string.Join(", ", new[] { company.Address, company.City, company.State, company.ZipCode }.Where(s => !string.IsNullOrWhiteSpace(s)))
            : "";

        var wh347Rows = lines.Select(line =>
        {
            employeeMap.TryGetValue(line.EmployeeId, out var employee);
            var hourlyRate = line.RegularHours > 0 ? line.RegularPay / line.RegularHours : employee?.BaseHourlyRate ?? 0m;
            var fica = Math.Round(line.GrossPay * 0.0765m, 2, MidpointRounding.AwayFromZero);
            var withholding = Math.Round(line.GrossPay * 0.12m, 2, MidpointRounding.AwayFromZero);
            var otherDeductions = 0m;
            var totalDeductions = fica + withholding + otherDeductions;
            var netPay = line.GrossPay - totalDeductions;

            dailyHoursLookup.TryGetValue(line.EmployeeId, out var dailyHours);
            dailyHours ??= new Dictionary<DayOfWeek, decimal>();

            return new Wh347DetailRow(
                EmployeeName: employee?.FullName ?? line.EmployeeId.ToString(),
                EmployeeNumber: employee?.EmployeeNumber ?? "",
                Classification: employee?.Title ?? employee?.Classification.ToString() ?? "Worker",
                StraightTimeHours: line.RegularHours,
                OvertimeHours: line.OvertimeHours + line.DoubletimeHours,
                Rate: hourlyRate,
                GrossPay: line.GrossPay,
                Fica: fica,
                Withholding: withholding,
                OtherDeductions: otherDeductions,
                NetPay: netPay,
                MonHours: dailyHours.GetValueOrDefault(DayOfWeek.Monday),
                TueHours: dailyHours.GetValueOrDefault(DayOfWeek.Tuesday),
                WedHours: dailyHours.GetValueOrDefault(DayOfWeek.Wednesday),
                ThuHours: dailyHours.GetValueOrDefault(DayOfWeek.Thursday),
                FriHours: dailyHours.GetValueOrDefault(DayOfWeek.Friday),
                SatHours: dailyHours.GetValueOrDefault(DayOfWeek.Saturday),
                SunHours: dailyHours.GetValueOrDefault(DayOfWeek.Sunday));
        }).OrderBy(x => x.EmployeeName).ToList();

        var weekEndingStr = weekEnding?.ToString("MM/dd/yyyy") ?? "N/A";
        var periodStart = payPeriod?.StartDate;
        var periodEnd = payPeriod?.EndDate;

        return SimplePdfWriter.WriteWh347(new SimplePdfWriter.Wh347PdfModel(
            CompanyName: companyName,
            CompanyAddress: companyAddress,
            ProjectName: projectName,
            ProjectLocation: projectLocation,
            ContractNumber: contractNumber,
            PayrollNumber: run.Id.ToString()[..8],
            WeekEnding: weekEndingStr,
            PeriodStart: periodStart,
            PeriodEnd: periodEnd,
            Rows: wh347Rows.Select(row => new SimplePdfWriter.Wh347PdfRow(
                row.EmployeeName,
                row.EmployeeNumber,
                row.Classification,
                row.StraightTimeHours,
                row.OvertimeHours,
                row.Rate,
                row.GrossPay,
                row.Fica,
                row.Withholding,
                row.OtherDeductions,
                row.NetPay,
                row.MonHours,
                row.TueHours,
                row.WedHours,
                row.ThuHours,
                row.FriHours,
                row.SatHours,
                row.SunHours)).ToList()));
    }

    internal async Task<List<AgedArRow>> AssembleAgedArDataAsync(CancellationToken cancellationToken = default)
    {
        // AR = money owed TO the company. Use BillingApplication (G702 owner-side),
        // not PaymentApplication (subcontractor AP side).
        var outstandingStatuses = new[]
        {
            BillingApplicationStatus.SubmittedToOwner,
            BillingApplicationStatus.Disputed,
            BillingApplicationStatus.ArchitectCertified,
            BillingApplicationStatus.PaymentDue,
            BillingApplicationStatus.PartiallyPaid,
        };

        var applications = await db.Set<BillingApplication>()
            .AsNoTracking()
            .Where(a => !a.IsDeleted && outstandingStatuses.Contains(a.Status))
            .ToListAsync(cancellationToken);

        // Resolve owner/customer name via OwnerContract
        var contractIds = applications.Select(a => a.OwnerContractId).Distinct().ToList();
        var contractMap = await db.Set<OwnerContract>()
            .AsNoTracking()
            .Where(c => contractIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, cancellationToken);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return applications.Select(app =>
        {
            contractMap.TryGetValue(app.OwnerContractId, out var contract);
            var customerName = contract?.OwnerName ?? contract?.ProjectName ?? "Unknown Customer";
            var amount = app.CurrentPaymentDue;
            var daysOverdue = today.DayNumber - app.PeriodThrough.DayNumber;

            return new AgedArRow(
                CustomerName: customerName,
                InvoiceNumber: $"APP-{app.ApplicationNumber:D3}",
                InvoiceDate: app.ApplicationDate,
                Amount: amount,
                Current: daysOverdue <= 0 ? amount : 0m,
                Days1To30: daysOverdue is >= 1 and <= 30 ? amount : 0m,
                Days31To60: daysOverdue is >= 31 and <= 60 ? amount : 0m,
                Days61To90: daysOverdue is >= 61 and <= 90 ? amount : 0m,
                Days91To120: daysOverdue is >= 91 and <= 120 ? amount : 0m,
                Days120Plus: daysOverdue > 120 ? amount : 0m);
        }).OrderBy(x => x.CustomerName).ThenBy(x => x.InvoiceDate).ToList();
    }

    public async Task<byte[]> GenerateAgedArPdfAsync(CancellationToken cancellationToken = default)
    {
        logger.LogInformation("Generating Aged AR PDF for tenant {TenantId}", tenantContext.TenantId);
        var rows = await AssembleAgedArDataAsync(cancellationToken);

        var bodyRows = new List<string[]>();
        foreach (var group in rows.GroupBy(x => x.CustomerName))
        {
            foreach (var row in group)
            {
                bodyRows.Add([
                    row.CustomerName,
                    row.InvoiceNumber,
                    row.InvoiceDate.ToString("MM/dd/yyyy"),
                    Money(row.Amount),
                    Money(row.Current),
                    Money(row.Days1To30),
                    Money(row.Days31To60),
                    Money(row.Days61To90),
                    Money(row.Days91To120),
                    Money(row.Days120Plus)
                ]);
            }

            bodyRows.Add([
                $"Subtotal - {group.Key}",
                string.Empty,
                string.Empty,
                Money(group.Sum(x => x.Amount)),
                Money(group.Sum(x => x.Current)),
                Money(group.Sum(x => x.Days1To30)),
                Money(group.Sum(x => x.Days31To60)),
                Money(group.Sum(x => x.Days61To90)),
                Money(group.Sum(x => x.Days91To120)),
                Money(group.Sum(x => x.Days120Plus))
            ]);
        }

        return BuildSimpleTablePdf(
            "Aged Receivables Report",
            DateTime.UtcNow,
            ["Customer", "Invoice #", "Date", "Amount", "Current", "1-30", "31-60", "61-90", "91-120", "120+"],
            bodyRows,
            [
                "GRAND TOTAL",
                string.Empty,
                string.Empty,
                Money(rows.Sum(x => x.Amount)),
                Money(rows.Sum(x => x.Current)),
                Money(rows.Sum(x => x.Days1To30)),
                Money(rows.Sum(x => x.Days31To60)),
                Money(rows.Sum(x => x.Days61To90)),
                Money(rows.Sum(x => x.Days91To120)),
                Money(rows.Sum(x => x.Days120Plus))
            ]);
    }

    public async Task<byte[]> GenerateSubmittalLogPdfAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        logger.LogInformation("Generating Submittal Log PDF for project {ProjectId}", projectId);

        var project = await db.Set<Project>()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == projectId, cancellationToken)
            ?? throw new KeyNotFoundException("Project not found");

        var submittals = await db.Set<PmSubmittal>()
            .AsNoTracking()
            .Where(s => s.ProjectId == projectId && !s.IsDeleted)
            .OrderBy(s => s.SubmittalNumber)
            .ToListAsync(cancellationToken);

        var rows = submittals.Select(s => new[]
        {
            s.SubmittalNumber.ToString(),
            s.Title,
            s.SpecSectionCode ?? string.Empty,
            s.SubmittalType.ToString(),
            s.Status.ToString(),
            s.RequiredByDate?.ToString("MM/dd/yyyy") ?? string.Empty,
            s.SubmittedDate?.ToString("MM/dd/yyyy") ?? string.Empty,
            s.ReturnedDate?.ToString("MM/dd/yyyy") ?? string.Empty,
            s.RevisionNumber.ToString()
        }).ToList();

        return BuildSimpleTablePdf(
            $"Submittal Log — {project.Name}",
            DateTime.UtcNow,
            ["No.", "Title", "Spec Section", "Type", "Status", "Required By", "Submitted", "Returned", "Rev#"],
            rows,
            [$"Total: {submittals.Count} submittals", string.Empty, string.Empty, string.Empty, string.Empty, string.Empty, string.Empty, string.Empty, string.Empty]);
    }

    public async Task<byte[]> GeneratePunchListPdfAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        logger.LogInformation("Generating Punch List PDF for project {ProjectId}", projectId);

        var project = await db.Set<Project>()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == projectId, cancellationToken)
            ?? throw new KeyNotFoundException("Project not found");

        var items = await db.Set<PmPunchListItem>()
            .AsNoTracking()
            .Where(i => i.ProjectId == projectId && !i.IsDeleted)
            .OrderBy(i => i.ItemNumber)
            .ToListAsync(cancellationToken);

        var rows = items.Select(i => new[]
        {
            i.ItemNumber.ToString(),
            i.Location,
            i.Category.ToString(),
            i.Description.Length > 80 ? i.Description[..80] + "..." : i.Description,
            i.ResponsiblePartyType.ToString(),
            i.AssignedToName ?? string.Empty,
            i.Status.ToString(),
            i.Priority.ToString(),
            i.DueDate?.ToString("MM/dd/yyyy") ?? string.Empty
        }).ToList();

        var openCount = items.Count(i => i.Status != PunchListItemStatus.Closed);
        var closedCount = items.Count(i => i.Status == PunchListItemStatus.Closed);

        return BuildSimpleTablePdf(
            $"Punch List — {project.Name}",
            DateTime.UtcNow,
            ["#", "Location", "Category", "Description", "Resp. Party", "Assigned To", "Status", "Priority", "Due Date"],
            rows,
            [$"Total: {items.Count} (Open: {openCount}, Closed: {closedCount})", string.Empty, string.Empty, string.Empty, string.Empty, string.Empty, string.Empty, string.Empty, string.Empty]);
    }

    private byte[] BuildSimpleTablePdf(
        string title,
        DateTime reportDate,
        IReadOnlyList<string> headers,
        IReadOnlyList<string[]> rows,
        string[] totals)
    {
        return SimplePdfWriter.WriteTable(
            GetCompanyName(),
            title,
            reportDate,
            headers,
            rows,
            totals);
    }

    private string GetCompanyName()
    {
        if (companyContext.IsResolved && !string.IsNullOrWhiteSpace(companyContext.CompanyName))
            return companyContext.CompanyName;

        if (tenantContext.IsResolved && !string.IsNullOrWhiteSpace(tenantContext.TenantName))
            return tenantContext.TenantName;

        return "Pitbull Construction Solutions";
    }

    private static string Money(decimal value)
        => value.ToString("C2");

    internal sealed record WipLineRow(
        string ProjectName,
        decimal ContractAmount,
        decimal CostsToDate,
        decimal EstimatedTotalCost,
        decimal PercentComplete,
        decimal EarnedRevenue,
        decimal BilledToDate,
        decimal OverUnderBilling);

    private sealed record ProjectCostRow(
        string CostCode,
        string Description,
        decimal Budget,
        decimal Actual,
        decimal Committed,
        decimal Variance,
        decimal PercentSpent);

    private sealed record RetentionSummaryRow(
        string ProjectName,
        decimal ContractAmount,
        decimal RetentionHeld,
        decimal RetentionReleased,
        decimal Balance);

    private sealed record Wh347DetailRow(
        string EmployeeName,
        string EmployeeNumber,
        string Classification,
        decimal StraightTimeHours,
        decimal OvertimeHours,
        decimal Rate,
        decimal GrossPay,
        decimal Fica,
        decimal Withholding,
        decimal OtherDeductions,
        decimal NetPay,
        decimal MonHours,
        decimal TueHours,
        decimal WedHours,
        decimal ThuHours,
        decimal FriHours,
        decimal SatHours,
        decimal SunHours);

    internal sealed record AgedArRow(
        string CustomerName,
        string InvoiceNumber,
        DateOnly InvoiceDate,
        decimal Amount,
        decimal Current,
        decimal Days1To30,
        decimal Days31To60,
        decimal Days61To90,
        decimal Days91To120,
        decimal Days120Plus);
}
