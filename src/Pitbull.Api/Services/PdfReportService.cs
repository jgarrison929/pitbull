using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
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

    public async Task<byte[]> GenerateWipSchedulePdfAsync(CancellationToken cancellationToken = default)
    {
        logger.LogInformation("Generating WIP Schedule PDF for tenant {TenantId}", tenantContext.TenantId);
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
                        BilledToDate: line.BilledToDate,
                        PercentComplete: line.PercentComplete,
                        OverUnderBilling: line.OverUnderBilling);
                })
                .OrderBy(x => x.ProjectName)
                .ToList();
        }

        var reportDate = report?.ReportDate.ToDateTime(TimeOnly.MinValue) ?? DateTime.UtcNow.Date;
        return BuildSimpleTablePdf(
            "WIP Schedule",
            reportDate,
            ["Project", "Contract", "Costs to Date", "Billed to Date", "% Complete", "Over/(Under)"],
            lines.Select(x => new[]
            {
                x.ProjectName,
                Money(x.ContractAmount),
                Money(x.CostsToDate),
                Money(x.BilledToDate),
                $"{x.PercentComplete:N1}%",
                Money(x.OverUnderBilling)
            }).ToList(),
            new[]
            {
                "TOTAL",
                Money(lines.Sum(x => x.ContractAmount)),
                Money(lines.Sum(x => x.CostsToDate)),
                Money(lines.Sum(x => x.BilledToDate)),
                string.Empty,
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

        var employeeMap = await db.Set<Employee>()
            .AsNoTracking()
            .Where(x => lines.Select(l => l.EmployeeId).Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var certifiedReport = await db.Set<CertifiedPayrollReport>()
            .AsNoTracking()
            .Where(x => x.PayrollRunId == payrollRunId)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        var projectName = "N/A";
        DateOnly? weekEnding = null;
        if (certifiedReport is not null)
        {
            var project = await db.Set<Project>()
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == certifiedReport.ProjectId, cancellationToken);
            projectName = project?.Name ?? "N/A";
            weekEnding = certifiedReport.WeekEnding;
        }

        var payPeriod = await db.Set<PayPeriod>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == run.PayPeriodId, cancellationToken);

        var rows = lines.Select(line =>
        {
            employeeMap.TryGetValue(line.EmployeeId, out var employee);
            var hourlyRate = line.RegularHours > 0 ? line.RegularPay / line.RegularHours : employee?.BaseHourlyRate ?? 0m;
            var deductions = Math.Round(line.GrossPay * 0.22m, 2, MidpointRounding.AwayFromZero);
            var netPay = line.GrossPay - deductions;

            return new Wh347Row(
                EmployeeName: employee?.FullName ?? line.EmployeeId.ToString(),
                Classification: employee?.Title ?? employee?.Classification.ToString() ?? "Worker",
                StraightTimeHours: line.RegularHours,
                OvertimeHours: line.OvertimeHours + line.DoubletimeHours,
                Rate: hourlyRate,
                GrossPay: line.GrossPay,
                Deductions: deductions,
                NetPay: netPay);
        }).OrderBy(x => x.EmployeeName).ToList();

        var companyName = GetCompanyName();
        var now = DateTime.UtcNow;

        return Document.Create(document =>
        {
            document.Page(page =>
            {
                page.Margin(20);
                page.DefaultTextStyle(x => x.FontSize(9));

                page.Header().Element(container =>
                {
                    container.Column(column =>
                    {
                        column.Item().Element(x => BuildLetterhead(x, "Certified Payroll Report (WH-347)", now));
                        column.Item().PaddingTop(6).Row(row =>
                        {
                            row.RelativeItem().Text($"Contractor: {companyName}");
                            row.RelativeItem().Text($"Project: {projectName}");
                            row.RelativeItem().AlignRight().Text($"Run Date: {run.RunDate:MM/dd/yyyy}");
                        });

                        var periodText = payPeriod is null
                            ? "Payroll Period: N/A"
                            : $"Payroll Period: {payPeriod.StartDate:MM/dd/yyyy} - {payPeriod.EndDate:MM/dd/yyyy}";

                        column.Item().Row(row =>
                        {
                            row.RelativeItem().Text(periodText);
                            row.RelativeItem().AlignRight().Text($"Week Ending: {(weekEnding.HasValue ? weekEnding.Value.ToString("MM/dd/yyyy") : "N/A")}");
                        });
                    });
                });

                page.Content().PaddingTop(10).Column(column =>
                {
                    column.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(2);
                            columns.RelativeColumn(2);
                            columns.RelativeColumn();
                            columns.RelativeColumn();
                            columns.RelativeColumn();
                            columns.RelativeColumn();
                            columns.RelativeColumn();
                            columns.RelativeColumn();
                        });

                        table.Header(header =>
                        {
                            header.Cell().Element(HeaderCell).Text("Employee");
                            header.Cell().Element(HeaderCell).Text("Class");
                            header.Cell().Element(HeaderCell).AlignRight().Text("ST Hrs");
                            header.Cell().Element(HeaderCell).AlignRight().Text("OT Hrs");
                            header.Cell().Element(HeaderCell).AlignRight().Text("Rate");
                            header.Cell().Element(HeaderCell).AlignRight().Text("Gross");
                            header.Cell().Element(HeaderCell).AlignRight().Text("Deduct.");
                            header.Cell().Element(HeaderCell).AlignRight().Text("Net");
                        });

                        foreach (var row in rows)
                        {
                            table.Cell().Element(BodyCell).Text(row.EmployeeName);
                            table.Cell().Element(BodyCell).Text(row.Classification);
                            table.Cell().Element(BodyCell).AlignRight().Text(row.StraightTimeHours.ToString("N2"));
                            table.Cell().Element(BodyCell).AlignRight().Text(row.OvertimeHours.ToString("N2"));
                            table.Cell().Element(BodyCell).AlignRight().Text(Money(row.Rate));
                            table.Cell().Element(BodyCell).AlignRight().Text(Money(row.GrossPay));
                            table.Cell().Element(BodyCell).AlignRight().Text(Money(row.Deductions));
                            table.Cell().Element(BodyCell).AlignRight().Text(Money(row.NetPay));
                        }

                        table.Cell().Element(TotalCell).Text("TOTAL");
                        table.Cell().Element(TotalCell).Text(string.Empty);
                        table.Cell().Element(TotalCell).AlignRight().Text(rows.Sum(x => x.StraightTimeHours).ToString("N2"));
                        table.Cell().Element(TotalCell).AlignRight().Text(rows.Sum(x => x.OvertimeHours).ToString("N2"));
                        table.Cell().Element(TotalCell).AlignRight().Text(string.Empty);
                        table.Cell().Element(TotalCell).AlignRight().Text(Money(rows.Sum(x => x.GrossPay)));
                        table.Cell().Element(TotalCell).AlignRight().Text(Money(rows.Sum(x => x.Deductions)));
                        table.Cell().Element(TotalCell).AlignRight().Text(Money(rows.Sum(x => x.NetPay)));
                    });

                    column.Item().PaddingTop(24).Row(row =>
                    {
                        row.RelativeItem().BorderTop(1).PaddingTop(4).Text("Authorized Signature");
                        row.ConstantItem(30);
                        row.RelativeItem().BorderTop(1).PaddingTop(4).Text("Date");
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

    public async Task<byte[]> GenerateAgedArPdfAsync(CancellationToken cancellationToken = default)
    {
        logger.LogInformation("Generating Aged AR PDF for tenant {TenantId}", tenantContext.TenantId);
        var applications = await db.Set<PaymentApplication>()
            .AsNoTracking()
            .Where(x => x.Status != PaymentApplicationStatus.Paid
                        && x.Status != PaymentApplicationStatus.Void
                        && x.Status != PaymentApplicationStatus.Rejected)
            .ToListAsync(cancellationToken);

        var subcontractMap = await db.Set<Subcontract>()
            .AsNoTracking()
            .Where(x => applications.Select(a => a.SubcontractId).Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var today = DateTime.UtcNow.Date;
        var rows = applications.Select(app =>
        {
            subcontractMap.TryGetValue(app.SubcontractId, out var subcontract);
            var customerName = subcontract?.SubcontractorName ?? "Unknown";
            var amount = app.CurrentPaymentDue;
            var age = Math.Max(0, (today - app.PeriodEnd.Date).Days);

            return new AgedArRow(
                CustomerName: customerName,
                InvoiceNumber: app.InvoiceNumber ?? $"APP-{app.ApplicationNumber:D3}",
                InvoiceDate: app.PeriodEnd.Date,
                Amount: amount,
                Current: age <= 30 ? amount : 0m,
                Thirty: age is >= 31 and <= 60 ? amount : 0m,
                Sixty: age is >= 61 and <= 90 ? amount : 0m,
                Ninety: age is >= 91 and <= 120 ? amount : 0m,
                NinetyPlus: age > 120 ? amount : 0m);
        }).OrderBy(x => x.CustomerName).ThenBy(x => x.InvoiceDate).ToList();

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
                    Money(row.Thirty),
                    Money(row.Sixty),
                    Money(row.Ninety),
                    Money(row.NinetyPlus)
                ]);
            }

            bodyRows.Add([
                $"Subtotal - {group.Key}",
                string.Empty,
                string.Empty,
                Money(group.Sum(x => x.Amount)),
                Money(group.Sum(x => x.Current)),
                Money(group.Sum(x => x.Thirty)),
                Money(group.Sum(x => x.Sixty)),
                Money(group.Sum(x => x.Ninety)),
                Money(group.Sum(x => x.NinetyPlus))
            ]);
        }

        return BuildSimpleTablePdf(
            "Aged AR Report",
            DateTime.UtcNow,
            ["Customer", "Invoice #", "Inv Date", "Amount", "Current", "30", "60", "90", "90+"],
            bodyRows,
            [
                "GRAND TOTAL",
                string.Empty,
                string.Empty,
                Money(rows.Sum(x => x.Amount)),
                Money(rows.Sum(x => x.Current)),
                Money(rows.Sum(x => x.Thirty)),
                Money(rows.Sum(x => x.Sixty)),
                Money(rows.Sum(x => x.Ninety)),
                Money(rows.Sum(x => x.NinetyPlus))
            ]);
    }

    public async Task<byte[]> GenerateSubmittalLogPdfAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        logger.LogInformation("Generating Submittal Log PDF for project {ProjectId}", projectId);

        var project = await db.Set<Project>()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == projectId, cancellationToken);

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
            $"Submittal Log — {project?.Name ?? "Unknown Project"}",
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
            .FirstOrDefaultAsync(p => p.Id == projectId, cancellationToken);

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
            $"Punch List — {project?.Name ?? "Unknown Project"}",
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

    private sealed record WipLineRow(
        string ProjectName,
        decimal ContractAmount,
        decimal CostsToDate,
        decimal BilledToDate,
        decimal PercentComplete,
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

    private sealed record Wh347Row(
        string EmployeeName,
        string Classification,
        decimal StraightTimeHours,
        decimal OvertimeHours,
        decimal Rate,
        decimal GrossPay,
        decimal Deductions,
        decimal NetPay);

    private sealed record AgedArRow(
        string CustomerName,
        string InvoiceNumber,
        DateTime InvoiceDate,
        decimal Amount,
        decimal Current,
        decimal Thirty,
        decimal Sixty,
        decimal Ninety,
        decimal NinetyPlus);
}
