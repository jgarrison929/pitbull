using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.ProjectManagement.Domain;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Entities;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

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
    static PdfReportService()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

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

        return Document.Create(document =>
        {
            document.Page(page =>
            {
                page.Size(PageSizes.Letter.Landscape());
                page.Margin(18);
                page.DefaultTextStyle(x => x.FontSize(7));

                // HEADER
                page.Header().Column(column =>
                {
                    // Title row
                    column.Item().Row(row =>
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text("U.S. Department of Labor").FontSize(6);
                            c.Item().Text("PAYROLL").Bold().FontSize(12);
                            c.Item().Text("(WH-347)").FontSize(7);
                        });
                        row.RelativeItem(2).AlignCenter().Column(c =>
                        {
                            c.Item().Text("Wage and Hour Division").FontSize(6);
                            c.Item().PaddingTop(2).Text($"Week Ending: {weekEndingStr}").SemiBold().FontSize(8);
                        });
                        row.RelativeItem().AlignRight().Column(c =>
                        {
                            c.Item().Text("OMB No.: 1235-0008").FontSize(6);
                            c.Item().Text("Exp.: 02/28/2026").FontSize(6);
                        });
                    });

                    column.Item().PaddingTop(4).LineHorizontal(0.5f).LineColor(Colors.Black);

                    // Info block
                    column.Item().PaddingTop(3).Row(row =>
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text(text =>
                            {
                                text.Span("Contractor: ").SemiBold();
                                text.Span(companyName);
                            });
                            if (!string.IsNullOrWhiteSpace(companyAddress))
                                c.Item().Text(text =>
                                {
                                    text.Span("Address: ").SemiBold();
                                    text.Span(companyAddress);
                                });
                        });
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text(text =>
                            {
                                text.Span("Project: ").SemiBold();
                                text.Span(projectName);
                            });
                            if (!string.IsNullOrWhiteSpace(projectLocation))
                                c.Item().Text(text =>
                                {
                                    text.Span("Location: ").SemiBold();
                                    text.Span(projectLocation);
                                });
                        });
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text(text =>
                            {
                                text.Span("Contract #: ").SemiBold();
                                text.Span(contractNumber);
                            });
                            c.Item().Text(text =>
                            {
                                text.Span("Payroll #: ").SemiBold();
                                text.Span(run.Id.ToString()[..8]);
                            });
                        });
                    });

                    column.Item().PaddingTop(3).LineHorizontal(0.5f).LineColor(Colors.Grey.Lighten1);
                });

                // MAIN TABLE
                page.Content().PaddingTop(4).Column(contentCol =>
                {
                    contentCol.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.ConstantColumn(110); // (1) Name
                            columns.ConstantColumn(32);  // (2) No. W/H Exemptions
                            columns.ConstantColumn(70);  // (3) Work Classification
                            columns.ConstantColumn(22);  // (4) OT/ST
                            columns.ConstantColumn(28);  // Mon
                            columns.ConstantColumn(28);  // Tue
                            columns.ConstantColumn(28);  // Wed
                            columns.ConstantColumn(28);  // Thu
                            columns.ConstantColumn(28);  // Fri
                            columns.ConstantColumn(28);  // Sat
                            columns.ConstantColumn(28);  // Sun
                            columns.ConstantColumn(36);  // Total Hours
                            columns.ConstantColumn(44);  // Rate of Pay
                            columns.ConstantColumn(52);  // Gross Amount
                            columns.ConstantColumn(38);  // FICA
                            columns.ConstantColumn(38);  // W/H
                            columns.ConstantColumn(32);  // Other
                            columns.ConstantColumn(52);  // Net Wages
                        });

                        // Header row
                        table.Header(header =>
                        {
                            header.Cell().Element(Wh347HeaderCell).Text("(1) Name, Address\n& Last 4 SSN");
                            header.Cell().Element(Wh347HeaderCell).AlignCenter().Text("(2)\nExempt.");
                            header.Cell().Element(Wh347HeaderCell).Text("(3) Work\nClassification");
                            header.Cell().Element(Wh347HeaderCell).AlignCenter().Text("OT\nor ST");
                            header.Cell().Element(Wh347HeaderCell).AlignCenter().Text("Mon");
                            header.Cell().Element(Wh347HeaderCell).AlignCenter().Text("Tue");
                            header.Cell().Element(Wh347HeaderCell).AlignCenter().Text("Wed");
                            header.Cell().Element(Wh347HeaderCell).AlignCenter().Text("Thu");
                            header.Cell().Element(Wh347HeaderCell).AlignCenter().Text("Fri");
                            header.Cell().Element(Wh347HeaderCell).AlignCenter().Text("Sat");
                            header.Cell().Element(Wh347HeaderCell).AlignCenter().Text("Sun");
                            header.Cell().Element(Wh347HeaderCell).AlignCenter().Text("Total\nHours");
                            header.Cell().Element(Wh347HeaderCell).AlignRight().Text("Rate\nof Pay");
                            header.Cell().Element(Wh347HeaderCell).AlignRight().Text("Gross\nEarned");
                            header.Cell().Element(Wh347HeaderCell).AlignCenter().Text("FICA");
                            header.Cell().Element(Wh347HeaderCell).AlignCenter().Text("W/H");
                            header.Cell().Element(Wh347HeaderCell).AlignCenter().Text("Other");
                            header.Cell().Element(Wh347HeaderCell).AlignRight().Text("Net\nWages");
                        });

                        // Employee rows — two sub-rows per employee: ST and OT
                        foreach (var row in wh347Rows)
                        {
                            var totalSt = row.StraightTimeHours;
                            var totalOt = row.OvertimeHours;

                            // ST row
                            table.Cell().RowSpan(2).Element(BodyCell).Text($"{row.EmployeeName}\n#{row.EmployeeNumber}").FontSize(6);
                            table.Cell().RowSpan(2).Element(BodyCell).AlignCenter().Text("");
                            table.Cell().RowSpan(2).Element(BodyCell).Text(row.Classification).FontSize(6);
                            table.Cell().Element(BodyCell).AlignCenter().Text("ST");
                            // Daily hours for ST — show the day values on ST row
                            table.Cell().Element(BodyCell).AlignCenter().Text(Hrs(row.MonHours));
                            table.Cell().Element(BodyCell).AlignCenter().Text(Hrs(row.TueHours));
                            table.Cell().Element(BodyCell).AlignCenter().Text(Hrs(row.WedHours));
                            table.Cell().Element(BodyCell).AlignCenter().Text(Hrs(row.ThuHours));
                            table.Cell().Element(BodyCell).AlignCenter().Text(Hrs(row.FriHours));
                            table.Cell().Element(BodyCell).AlignCenter().Text(Hrs(row.SatHours));
                            table.Cell().Element(BodyCell).AlignCenter().Text(Hrs(row.SunHours));
                            table.Cell().Element(BodyCell).AlignCenter().Text(totalSt.ToString("N1"));
                            table.Cell().RowSpan(2).Element(BodyCell).AlignRight().Text(Money(row.Rate));
                            table.Cell().RowSpan(2).Element(BodyCell).AlignRight().Text(Money(row.GrossPay));
                            table.Cell().RowSpan(2).Element(BodyCell).AlignRight().Text(Money(row.Fica)).FontSize(6);
                            table.Cell().RowSpan(2).Element(BodyCell).AlignRight().Text(Money(row.Withholding)).FontSize(6);
                            table.Cell().RowSpan(2).Element(BodyCell).AlignRight().Text(row.OtherDeductions > 0 ? Money(row.OtherDeductions) : "");
                            table.Cell().RowSpan(2).Element(BodyCell).AlignRight().Text(Money(row.NetPay));

                            // OT row
                            table.Cell().Element(BodyCell).AlignCenter().Text("OT");
                            // OT daily blanks
                            for (var i = 0; i < 7; i++)
                                table.Cell().Element(BodyCell).AlignCenter().Text("");
                            table.Cell().Element(BodyCell).AlignCenter().Text(totalOt > 0 ? totalOt.ToString("N1") : "");
                        }

                        // Totals row
                        table.Cell().Element(TotalCell).Text("TOTALS");
                        table.Cell().Element(TotalCell).Text("");
                        table.Cell().Element(TotalCell).Text("");
                        table.Cell().Element(TotalCell).Text("");
                        table.Cell().Element(TotalCell).AlignCenter().Text(Hrs(wh347Rows.Sum(r => r.MonHours)));
                        table.Cell().Element(TotalCell).AlignCenter().Text(Hrs(wh347Rows.Sum(r => r.TueHours)));
                        table.Cell().Element(TotalCell).AlignCenter().Text(Hrs(wh347Rows.Sum(r => r.WedHours)));
                        table.Cell().Element(TotalCell).AlignCenter().Text(Hrs(wh347Rows.Sum(r => r.ThuHours)));
                        table.Cell().Element(TotalCell).AlignCenter().Text(Hrs(wh347Rows.Sum(r => r.FriHours)));
                        table.Cell().Element(TotalCell).AlignCenter().Text(Hrs(wh347Rows.Sum(r => r.SatHours)));
                        table.Cell().Element(TotalCell).AlignCenter().Text(Hrs(wh347Rows.Sum(r => r.SunHours)));
                        table.Cell().Element(TotalCell).AlignCenter().Text((wh347Rows.Sum(r => r.StraightTimeHours) + wh347Rows.Sum(r => r.OvertimeHours)).ToString("N1"));
                        table.Cell().Element(TotalCell).Text("");
                        table.Cell().Element(TotalCell).AlignRight().Text(Money(wh347Rows.Sum(r => r.GrossPay)));
                        table.Cell().Element(TotalCell).AlignRight().Text(Money(wh347Rows.Sum(r => r.Fica)));
                        table.Cell().Element(TotalCell).AlignRight().Text(Money(wh347Rows.Sum(r => r.Withholding)));
                        table.Cell().Element(TotalCell).AlignRight().Text(Money(wh347Rows.Sum(r => r.OtherDeductions)));
                        table.Cell().Element(TotalCell).AlignRight().Text(Money(wh347Rows.Sum(r => r.NetPay)));
                    });

                    // Statement of Compliance
                    contentCol.Item().PaddingTop(12).Column(complianceCol =>
                    {
                        complianceCol.Item().Text("STATEMENT OF COMPLIANCE").Bold().FontSize(8);
                        complianceCol.Item().PaddingTop(4).Text(text =>
                        {
                            text.Span("I, ");
                            text.Span("_______________________________").Underline();
                            text.Span(" (Name of signatory party), ");
                            text.Span("_______________________________").Underline();
                            text.Span(" (Title),");
                        });
                        complianceCol.Item().Text("do hereby state:");
                        complianceCol.Item().PaddingTop(2).Text(
                            "(1) That I pay or supervise the payment of the persons employed on the " +
                            $"{projectName} during the payroll period commencing on the " +
                            $"{(periodStart.HasValue ? periodStart.Value.Day.ToString() : "___")} day of " +
                            $"{(periodStart.HasValue ? periodStart.Value.ToString("MMMM, yyyy") : "___________, ______")}" +
                            $" and ending the {(periodEnd.HasValue ? periodEnd.Value.Day.ToString() : "___")} day of " +
                            $"{(periodEnd.HasValue ? periodEnd.Value.ToString("MMMM, yyyy") : "___________, ______")}; " +
                            "that all persons employed on said project have been paid the full weekly wages earned, " +
                            "that no rebates have been or will be made either directly or indirectly to or on behalf of said " +
                            $"{companyName} from the full weekly wages earned by any person and that no " +
                            "deductions have been made either directly or indirectly from the full wages earned by any person, " +
                            "other than permissible deductions as defined in Regulations, Part 3 (29 CFR Subtitle A), " +
                            "of the Secretary of Labor under the Copeland Act, as amended (48 Stat. 948, 63 Stat. 108, " +
                            "72 Stat. 967; 76 Stat. 357; 40 U.S.C. \u00a7 3145), and described below:").FontSize(6);

                        complianceCol.Item().PaddingTop(4).Text("_______________________________________________").FontSize(7);
                        complianceCol.Item().Text("_______________________________________________").FontSize(7);

                        complianceCol.Item().PaddingTop(4).Text(
                            "(2) That any payrolls otherwise under this contract required to be submitted for the above period " +
                            "are correct and complete; that the wage rates for laborers or mechanics contained therein are not " +
                            "less than the applicable wage rates contained in any wage determination incorporated into the " +
                            "contract; that the classifications set forth therein for each laborer or mechanic conform with " +
                            "the work he performed.").FontSize(6);

                        complianceCol.Item().PaddingTop(10).Row(row =>
                        {
                            row.RelativeItem().Column(c =>
                            {
                                c.Item().BorderBottom(1).PaddingBottom(16).Text("");
                                c.Item().PaddingTop(2).Text("Signature").FontSize(6);
                            });
                            row.ConstantItem(30);
                            row.RelativeItem().Column(c =>
                            {
                                c.Item().BorderBottom(1).PaddingBottom(16).Text("");
                                c.Item().PaddingTop(2).Text("Date").FontSize(6);
                            });
                            row.ConstantItem(30);
                            row.RelativeItem(2).Column(c =>
                            {
                                c.Item().BorderBottom(1).PaddingBottom(16).Text("");
                                c.Item().PaddingTop(2).Text("Name and Title").FontSize(6);
                            });
                        });
                    });
                });

                page.Footer().AlignCenter().Text(text =>
                {
                    text.Span("Page ");
                    text.CurrentPageNumber();
                    text.Span(" of ");
                    text.TotalPages();
                });
            });
        }).GeneratePdf();
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
        var companyName = GetCompanyName();

        return Document.Create(document =>
        {
            document.Page(page =>
            {
                page.Margin(20);
                page.DefaultTextStyle(x => x.FontSize(9));

                page.Header().Element(container => BuildLetterhead(container, title, reportDate));

                page.Content().PaddingTop(10).Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        for (var i = 0; i < headers.Count; i++)
                            columns.RelativeColumn();
                    });

                    table.Header(header =>
                    {
                        foreach (var head in headers)
                            header.Cell().Element(HeaderCell).Text(head);
                    });

                    foreach (var row in rows)
                    {
                        for (var i = 0; i < headers.Count; i++)
                        {
                            var value = i < row.Length ? row[i] : string.Empty;
                            var alignRight = i > 0;
                            if (alignRight)
                                table.Cell().Element(BodyCell).AlignRight().Text(value);
                            else
                                table.Cell().Element(BodyCell).Text(value);
                        }
                    }

                    for (var i = 0; i < headers.Count; i++)
                    {
                        var value = i < totals.Length ? totals[i] : string.Empty;
                        var alignRight = i > 0;
                        if (alignRight)
                            table.Cell().Element(TotalCell).AlignRight().Text(value);
                        else
                            table.Cell().Element(TotalCell).Text(value);
                    }
                });

                page.Footer().AlignCenter().Text(text =>
                {
                    text.Span($"{companyName} • Generated {reportDate:MM/dd/yyyy} • Page ");
                    text.CurrentPageNumber();
                    text.Span(" of ");
                    text.TotalPages();
                });
            });
        }).GeneratePdf();
    }

    private IContainer BuildLetterhead(IContainer container, string reportTitle, DateTime reportDate)
    {
        container.Column(column =>
        {
            column.Item().Row(row =>
            {
                row.ConstantItem(48).Height(28).Border(1).BorderColor(Colors.Grey.Lighten2)
                    .AlignCenter().AlignMiddle().Text("LOGO").FontSize(8).FontColor(Colors.Grey.Darken1);

                row.ConstantItem(12);

                row.RelativeItem().Column(col =>
                {
                    col.Item().Text(GetCompanyName()).SemiBold().FontSize(14);
                    col.Item().Text(reportTitle).SemiBold();
                });

                row.RelativeItem().AlignRight().Text($"Report Date: {reportDate:MM/dd/yyyy}");
            });
            column.Item().PaddingTop(6).LineHorizontal(1).LineColor(Colors.Grey.Lighten2);
        });

        return container;
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

    private static IContainer HeaderCell(IContainer container)
        => container
            .Border(1)
            .BorderColor(Colors.Grey.Lighten2)
            .Background(Colors.Grey.Lighten4)
            .PaddingVertical(4)
            .PaddingHorizontal(3)
            .DefaultTextStyle(x => x.SemiBold());

    private static IContainer BodyCell(IContainer container)
        => container
            .Border(1)
            .BorderColor(Colors.Grey.Lighten3)
            .PaddingVertical(3)
            .PaddingHorizontal(3);

    private static IContainer TotalCell(IContainer container)
        => container
            .Border(1)
            .BorderColor(Colors.Grey.Lighten2)
            .Background(Colors.Grey.Lighten4)
            .PaddingVertical(4)
            .PaddingHorizontal(3)
            .DefaultTextStyle(x => x.SemiBold());

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

    private static IContainer Wh347HeaderCell(IContainer container)
        => container
            .Border(0.5f)
            .BorderColor(Colors.Black)
            .Background(Colors.Grey.Lighten4)
            .PaddingVertical(2)
            .PaddingHorizontal(2)
            .DefaultTextStyle(x => x.SemiBold().FontSize(6));

    private static string Hrs(decimal value)
        => value > 0 ? value.ToString("N1") : "";

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
