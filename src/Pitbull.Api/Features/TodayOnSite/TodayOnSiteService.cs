using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.MultiTenancy;
using Pitbull.ProjectManagement.Domain;
using Pitbull.Projects.Domain;
using Pitbull.RFIs.Domain;

namespace Pitbull.Api.Features.TodayOnSite;

public interface ITodayOnSiteService
{
    Task<TodayOnSiteDto?> GetForProjectAsync(Guid projectId, CancellationToken ct = default);
}

public sealed class TodayOnSiteService(
    PitbullDbContext db,
    ITenantContext tenantContext) : ITodayOnSiteService
{
    public async Task<TodayOnSiteDto?> GetForProjectAsync(Guid projectId, CancellationToken ct = default)
    {
        var tenantId = tenantContext.TenantId;
        var exists = await db.Set<Project>().AsNoTracking()
            .AnyAsync(p => p.Id == projectId && p.TenantId == tenantId && !p.IsDeleted, ct);
        if (!exists) return null;

        var (start, end, day) = TodayOnSiteDay.UtcDayWindow(DateTime.UtcNow);

        var reportIds = await db.Set<PmDailyReport>().AsNoTracking()
            .Where(r => r.ProjectId == projectId && r.TenantId == tenantId && !r.IsDeleted
                        && r.ReportDate >= start && r.ReportDate < end)
            .Select(r => r.Id)
            .ToListAsync(ct);

        var photoCount = reportIds.Count == 0
            ? 0
            : await db.Set<PmDailyReportPhoto>().AsNoTracking()
                .CountAsync(p => reportIds.Contains(p.DailyReportId) && !p.IsDeleted, ct);

        var openRfis = await db.Set<Rfi>().AsNoTracking()
            .CountAsync(r => r.ProjectId == projectId && r.TenantId == tenantId && !r.IsDeleted
                             && r.Status == RfiStatus.Open
                             && r.CreatedAt >= start && r.CreatedAt < end, ct);

        return new TodayOnSiteDto(
            projectId,
            day,
            reportIds.Count,
            photoCount,
            openRfis,
            TodayOnSiteDay.ActivityLabel);
    }
}
