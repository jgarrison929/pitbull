using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Bids.Domain;
using Pitbull.Billing.Features.Aging;
using Pitbull.Contracts.Domain;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.Entities;
using Pitbull.ProjectManagement.Domain;
using Pitbull.Projects.Domain;
using Pitbull.RFIs.Domain;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Api.Services;

/// <summary>
/// Truthful, role-oriented portfolio metrics for CEO / CFO dashboards.
/// Prefer honest labels over invented scores.
/// </summary>
public interface IRoleDashboardSummaryService
{
    Task<RoleDashboardSummaryDto> GetSummaryAsync(CancellationToken ct = default);
    Task<IReadOnlyList<SafetyIncidentListItemDto>> GetSafetyIncidentsYtdAsync(CancellationToken ct = default);
}

public sealed class RoleDashboardSummaryService(
    PitbullDbContext db,
    IAgingReportService agingReportService,
    ILogger<RoleDashboardSummaryService> logger) : IRoleDashboardSummaryService
{
    public async Task<RoleDashboardSummaryDto> GetSummaryAsync(CancellationToken ct = default)
    {
        var portfolioContractValue = await SafeAsync("PortfolioContractValue",
            () => db.Set<Project>().AsNoTracking()
                .Where(p => p.Status != ProjectStatus.Completed)
                .SumAsync(p => (decimal?)p.ContractAmount, ct), 0m) ?? 0m;

        var activeProjectCount = await SafeAsync("ActiveProjects",
            () => db.Set<Project>().AsNoTracking()
                .CountAsync(p => p.Status != ProjectStatus.Completed, ct), 0);

        var billedToDate = await SafeAsync("BilledToDate", () => ComputeBilledToDateAsync(ct), 0m);
        var unbilledContractValue = Math.Max(0m, portfolioContractValue - billedToDate);

        var aging = await LoadAgingAsync(ct);
        var arTotal = aging?.AccountsReceivable.Total ?? 0m;
        var arOverdue = aging is null
            ? 0m
            : aging.AccountsReceivable.Days31To60
              + aging.AccountsReceivable.Days61To90
              + aging.AccountsReceivable.Days90Plus;
        var apTotal = aging?.AccountsPayable.Total ?? 0m;
        var apDueNearTerm = aging is null
            ? 0m
            : aging.AccountsPayable.Current + aging.AccountsPayable.Days1To30;
        var arApNet = aging?.NetPosition ?? (arTotal - apTotal);

        var openChangeOrders = await SafeAsync("OpenCOs",
            () => db.Set<ChangeOrder>().AsNoTracking()
                .CountAsync(co =>
                    co.Status == ChangeOrderStatus.Pending
                    || co.Status == ChangeOrderStatus.UnderReview, ct), 0);

        var openCoAmount = await SafeAsync("OpenCoAmount",
            () => db.Set<ChangeOrder>().AsNoTracking()
                .Where(co =>
                    co.Status == ChangeOrderStatus.Pending
                    || co.Status == ChangeOrderStatus.UnderReview)
                .SumAsync(co => (decimal?)co.Amount, ct), 0m) ?? 0m;

        var openRfis = await SafeAsync("OpenRFIs",
            () => db.Set<Rfi>().AsNoTracking()
                .CountAsync(r => r.Status != RfiStatus.Closed, ct), 0);

        var safetyYtd = await SafeAsync("SafetyYtd", () => CountSafetyIncidentsYtdAsync(ct), 0);

        var compliance = await SafeAsync("Compliance", async () =>
        {
            var total = await db.Set<ComplianceDocument>().AsNoTracking().CountAsync(ct);
            var active = await db.Set<ComplianceDocument>().AsNoTracking()
                .CountAsync(x => x.Status == "Active", ct);
            var expiring = await db.Set<ComplianceDocument>().AsNoTracking()
                .CountAsync(x => x.Status == "ExpiringSoon", ct);
            var expired = await db.Set<ComplianceDocument>().AsNoTracking()
                .CountAsync(x => x.Status == "Expired", ct);
            return new ComplianceSnapshotDto(total, active, expiring, expired);
        }, new ComplianceSnapshotDto(0, 0, 0, 0));

        var yearStartDate = new DateOnly(DateTime.UtcNow.Year, 1, 1);
        var activeEmployees = await SafeAsync("ActiveEmployees",
            () => db.Set<Employee>().AsNoTracking().CountAsync(e => e.IsActive, ct), 0);
        var terminationsYtd = await SafeAsync("TerminationsYtd",
            () => db.Set<Employee>().AsNoTracking()
                .CountAsync(e => e.TerminationDate != null && e.TerminationDate >= yearStartDate, ct), 0);
        var hiresYtd = await SafeAsync("HiresYtd",
            () => db.Set<Employee>().AsNoTracking()
                .CountAsync(e => e.HireDate != null && e.HireDate >= yearStartDate, ct), 0);

        var openBidCount = await SafeAsync("OpenBids",
            () => db.Set<Bid>().AsNoTracking()
                .CountAsync(b => b.Status == BidStatus.Draft || b.Status == BidStatus.Submitted, ct), 0);
        var pipelineValue = await SafeAsync("PipelineValue",
            () => db.Set<Bid>().AsNoTracking()
                .Where(b => b.Status == BidStatus.Draft || b.Status == BidStatus.Submitted)
                .SumAsync(b => (decimal?)b.EstimatedValue, ct), 0m) ?? 0m;

        var activeCustomers = await SafeAsync("ActiveCustomers",
            () => db.Set<Customer>().AsNoTracking().CountAsync(c => c.IsActive, ct), 0);

        return new RoleDashboardSummaryDto(
            ActiveProjectCount: activeProjectCount,
            PortfolioContractValue: portfolioContractValue,
            BilledToDate: billedToDate,
            BilledToDateLabel: "Owner billed to date (G702 completed & stored)",
            UnbilledContractValue: unbilledContractValue,
            UnbilledContractValueLabel: "Unbilled contract value (portfolio − billed)",
            ArTotal: arTotal,
            ArOverdue: arOverdue,
            ApTotal: apTotal,
            ApDueNearTerm: apDueNearTerm,
            ArApNetPosition: arApNet,
            ArApNetPositionLabel: "AR − AP net position (aging)",
            OpenChangeOrderCount: openChangeOrders,
            OpenChangeOrderAmount: openCoAmount,
            OpenRfiCount: openRfis,
            SafetyIncidentsYtd: safetyYtd,
            Compliance: compliance,
            ActiveEmployeeCount: activeEmployees,
            TerminationsYtd: terminationsYtd,
            HiresYtd: hiresYtd,
            OpenBidCount: openBidCount,
            BidPipelineValue: pipelineValue,
            ActiveCustomerCount: activeCustomers);
    }

    private async Task<decimal> ComputeBilledToDateAsync(CancellationToken ct)
    {
        // Latest non-void application per owner contract — avoid double-counting progress apps.
        var apps = await db.Set<BillingApplication>().AsNoTracking()
            .Where(a => a.Status != BillingApplicationStatus.Void
                        && a.Status != BillingApplicationStatus.Draft)
            .Select(a => new
            {
                a.OwnerContractId,
                a.ApplicationNumber,
                a.TotalCompletedAndStoredToDate
            })
            .ToListAsync(ct);

        return apps
            .GroupBy(a => a.OwnerContractId)
            .Select(g => g.OrderByDescending(x => x.ApplicationNumber).First().TotalCompletedAndStoredToDate)
            .DefaultIfEmpty(0m)
            .Sum();
    }

    private async Task<int> CountSafetyIncidentsYtdAsync(CancellationToken ct)
    {
        var yearStartUtc = new DateTime(DateTime.UtcNow.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        // Incidents inherit CreatedAt from BaseEntity
        return await db.Set<PmDailyReportSafetyIncident>().AsNoTracking()
            .CountAsync(i => i.CreatedAt >= yearStartUtc, ct);
    }

    public async Task<IReadOnlyList<SafetyIncidentListItemDto>> GetSafetyIncidentsYtdAsync(CancellationToken ct = default)
    {
        var yearStartUtc = new DateTime(DateTime.UtcNow.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        var incidents = await db.Set<PmDailyReportSafetyIncident>().AsNoTracking()
            .Where(i => i.CreatedAt >= yearStartUtc)
            .OrderByDescending(i => i.CreatedAt)
            .Take(200)
            .Select(i => new
            {
                i.Id,
                i.DailyReportId,
                i.IncidentType,
                i.Severity,
                i.Description,
                i.CreatedAt
            })
            .ToListAsync(ct);

        if (incidents.Count == 0)
            return Array.Empty<SafetyIncidentListItemDto>();

        var reportIds = incidents.Select(i => i.DailyReportId).Distinct().ToList();
        var reports = await db.Set<PmDailyReport>().AsNoTracking()
            .Where(r => reportIds.Contains(r.Id))
            .Select(r => new { r.Id, r.ProjectId, r.ReportDate })
            .ToListAsync(ct);
        var reportMap = reports.ToDictionary(r => r.Id);

        var projectIds = reports.Select(r => r.ProjectId).Distinct().ToList();
        var projects = await db.Set<Project>().AsNoTracking()
            .Where(p => projectIds.Contains(p.Id))
            .Select(p => new { p.Id, p.Name, p.Number })
            .ToListAsync(ct);
        var projectMap = projects.ToDictionary(p => p.Id);

        return incidents.Select(i =>
        {
            reportMap.TryGetValue(i.DailyReportId, out var report);
            string projectName = "";
            string projectNumber = "";
            Guid? projectId = null;
            DateOnly? reportDate = null;
            if (report != null)
            {
                projectId = report.ProjectId;
                reportDate = DateOnly.FromDateTime(report.ReportDate);
                if (projectMap.TryGetValue(report.ProjectId, out var proj))
                {
                    projectName = proj.Name;
                    projectNumber = proj.Number;
                }
            }

            return new SafetyIncidentListItemDto(
                i.Id,
                projectId,
                projectName,
                projectNumber,
                reportDate,
                i.IncidentType.ToString(),
                i.Severity.ToString(),
                i.Description,
                i.CreatedAt);
        }).ToList();
    }

    private async Task<AgingSummaryResult?> LoadAgingAsync(CancellationToken ct)
    {
        try
        {
            var result = await agingReportService.GetAgingSummaryAsync(ct: ct);
            return result.IsSuccess ? result.Value : null;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Aging summary unavailable for role dashboard");
            return null;
        }
    }

    private async Task<T> SafeAsync<T>(string name, Func<Task<T>> factory, T fallback)
    {
        try
        {
            return await factory();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Role dashboard sub-task '{SubTask}' failed", name);
            return fallback;
        }
    }
}

public sealed record ComplianceSnapshotDto(
    int Total,
    int Active,
    int ExpiringSoon,
    int Expired);

public sealed record RoleDashboardSummaryDto(
    int ActiveProjectCount,
    decimal PortfolioContractValue,
    decimal BilledToDate,
    string BilledToDateLabel,
    decimal UnbilledContractValue,
    string UnbilledContractValueLabel,
    decimal ArTotal,
    decimal ArOverdue,
    decimal ApTotal,
    decimal ApDueNearTerm,
    decimal ArApNetPosition,
    string ArApNetPositionLabel,
    int OpenChangeOrderCount,
    decimal OpenChangeOrderAmount,
    int OpenRfiCount,
    int SafetyIncidentsYtd,
    ComplianceSnapshotDto Compliance,
    int ActiveEmployeeCount,
    int TerminationsYtd,
    int HiresYtd,
    int OpenBidCount,
    decimal BidPipelineValue,
    int ActiveCustomerCount);

public sealed record SafetyIncidentListItemDto(
    Guid Id,
    Guid? ProjectId,
    string ProjectName,
    string ProjectNumber,
    DateOnly? ReportDate,
    string IncidentType,
    string Severity,
    string Description,
    DateTime CreatedAtUtc);
