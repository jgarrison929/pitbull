using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Features.Aging;

public class AgingReportService(
    PitbullDbContext db,
    ILogger<AgingReportService> logger) : IAgingReportService
{
    public async Task<Result<VendorAgingResult>> GetVendorAgingAsync(
        DateOnly? asOfDate = null, CancellationToken ct = default)
    {
        var today = asOfDate ?? DateOnly.FromDateTime(DateTime.UtcNow);

        try
        {
            // Outstanding invoices: everything except Paid
            var invoices = await db.Set<VendorInvoice>()
                .AsNoTracking()
                .Where(i => !i.IsDeleted && i.Status != VendorInvoiceStatus.Paid)
                .Select(i => new
                {
                    i.VendorId,
                    i.DueDate,
                    i.TotalAmount,
                })
                .ToListAsync(ct);

            // Get vendor names for the vendors that have invoices
            var vendorIds = invoices.Select(i => i.VendorId).Distinct().ToList();
            var vendors = await db.Set<Vendor>()
                .AsNoTracking()
                .Where(v => !v.IsDeleted && vendorIds.Contains(v.Id))
                .Select(v => new { v.Id, v.Name, v.Code })
                .ToDictionaryAsync(v => v.Id, ct);

            // Group by vendor and bucket
            var vendorLines = invoices
                .GroupBy(i => i.VendorId)
                .Select(g =>
                {
                    var buckets = ComputeBuckets(g, x => x.DueDate, x => x.TotalAmount, today);
                    var vendor = vendors.GetValueOrDefault(g.Key);
                    return new VendorAgingLineItem(
                        VendorId: g.Key,
                        VendorName: vendor?.Name ?? "Unknown Vendor",
                        VendorCode: vendor?.Code ?? "",
                        InvoiceCount: g.Count(),
                        Current: buckets.Current,
                        Days1To30: buckets.Days1To30,
                        Days31To60: buckets.Days31To60,
                        Days61To90: buckets.Days61To90,
                        Days90Plus: buckets.Days90Plus,
                        Total: buckets.Total
                    );
                })
                .OrderByDescending(v => v.Total)
                .ToList();

            var summary = SumBuckets(vendorLines, v => v.Current, v => v.Days1To30,
                v => v.Days31To60, v => v.Days61To90, v => v.Days90Plus);

            return Result.Success(new VendorAgingResult(summary, vendorLines, today));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to generate vendor aging report");
            return Result.Failure<VendorAgingResult>("Failed to generate vendor aging report", "DATABASE_ERROR");
        }
    }

    public async Task<Result<CustomerAgingResult>> GetCustomerAgingAsync(
        DateOnly? asOfDate = null, CancellationToken ct = default)
    {
        var today = asOfDate ?? DateOnly.FromDateTime(DateTime.UtcNow);

        try
        {
            // Outstanding billing applications: submitted but not paid/void
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
                .Select(a => new
                {
                    a.ProjectId,
                    a.PeriodThrough,
                    a.CurrentPaymentDue,
                })
                .ToListAsync(ct);

            // Get project names
            var projectIds = applications.Select(a => a.ProjectId).Distinct().ToList();
            var projects = await db.Set<Projects.Domain.Project>()
                .AsNoTracking()
                .Where(p => !p.IsDeleted && projectIds.Contains(p.Id))
                .Select(p => new { p.Id, p.Name, p.Number })
                .ToDictionaryAsync(p => p.Id, ct);

            // Group by project and bucket
            var projectLines = applications
                .GroupBy(a => a.ProjectId)
                .Select(g =>
                {
                    var buckets = ComputeBuckets(g, x => x.PeriodThrough, x => x.CurrentPaymentDue, today);
                    var project = projects.GetValueOrDefault(g.Key);
                    return new CustomerAgingLineItem(
                        ProjectId: g.Key,
                        ProjectName: project?.Name ?? "Unknown Project",
                        ProjectNumber: project?.Number ?? "",
                        ApplicationCount: g.Count(),
                        Current: buckets.Current,
                        Days1To30: buckets.Days1To30,
                        Days31To60: buckets.Days31To60,
                        Days61To90: buckets.Days61To90,
                        Days90Plus: buckets.Days90Plus,
                        Total: buckets.Total
                    );
                })
                .OrderByDescending(p => p.Total)
                .ToList();

            var summary = SumBuckets(projectLines, p => p.Current, p => p.Days1To30,
                p => p.Days31To60, p => p.Days61To90, p => p.Days90Plus);

            return Result.Success(new CustomerAgingResult(summary, projectLines, today));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to generate customer aging report");
            return Result.Failure<CustomerAgingResult>("Failed to generate customer aging report", "DATABASE_ERROR");
        }
    }

    public async Task<Result<AgingSummaryResult>> GetAgingSummaryAsync(
        DateOnly? asOfDate = null, CancellationToken ct = default)
    {
        var apResult = await GetVendorAgingAsync(asOfDate, ct);
        if (!apResult.IsSuccess)
            return Result.Failure<AgingSummaryResult>(apResult.Error!, apResult.ErrorCode);

        var arResult = await GetCustomerAgingAsync(asOfDate, ct);
        if (!arResult.IsSuccess)
            return Result.Failure<AgingSummaryResult>(arResult.Error!, arResult.ErrorCode);

        var ap = apResult.Value!.Summary;
        var ar = arResult.Value!.Summary;
        var today = asOfDate ?? DateOnly.FromDateTime(DateTime.UtcNow);

        return Result.Success(new AgingSummaryResult(
            AccountsPayable: ap,
            AccountsReceivable: ar,
            NetPosition: ar.Total - ap.Total,
            AsOfDate: today
        ));
    }

    // ── Bucket calculation helpers ──

    private static AgingBuckets ComputeBuckets<T>(
        IEnumerable<T> items,
        Func<T, DateOnly> getDate,
        Func<T, decimal> getAmount,
        DateOnly asOfDate)
    {
        decimal current = 0, d1to30 = 0, d31to60 = 0, d61to90 = 0, d90plus = 0;

        foreach (var item in items)
        {
            var dueDate = getDate(item);
            var amount = getAmount(item);
            int daysOverdue = asOfDate.ToDateTime(TimeOnly.MinValue).Subtract(dueDate.ToDateTime(TimeOnly.MinValue)).Days;

            if (daysOverdue <= 0)
                current += amount;
            else if (daysOverdue <= 30)
                d1to30 += amount;
            else if (daysOverdue <= 60)
                d31to60 += amount;
            else if (daysOverdue <= 90)
                d61to90 += amount;
            else
                d90plus += amount;
        }

        return new AgingBuckets(current, d1to30, d31to60, d61to90, d90plus,
            current + d1to30 + d31to60 + d61to90 + d90plus);
    }

    private static AgingBuckets SumBuckets<T>(
        IReadOnlyList<T> items,
        Func<T, decimal> getCurrent,
        Func<T, decimal> get1to30,
        Func<T, decimal> get31to60,
        Func<T, decimal> get61to90,
        Func<T, decimal> get90plus)
    {
        var current = items.Sum(getCurrent);
        var d1to30 = items.Sum(get1to30);
        var d31to60 = items.Sum(get31to60);
        var d61to90 = items.Sum(get61to90);
        var d90plus = items.Sum(get90plus);

        return new AgingBuckets(current, d1to30, d31to60, d61to90, d90plus,
            current + d1to30 + d31to60 + d61to90 + d90plus);
    }
}
