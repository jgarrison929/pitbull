using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Core.Data;
using Pitbull.Core.MultiTenancy;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Pending approvals aggregate (2.21.4). Real DB counts under tenant/company RLS.
/// Mobile Phase 2 expands approve for time entries (see workflow-approvals-phase2.md).
/// </summary>
[ApiController]
[Route("api/approvals")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Approvals")]
public class ApprovalsController(
    PitbullDbContext db,
    ICompanyContext companyContext) : ControllerBase
{
    /// <summary>
    /// Aggregate pending approval counts by lifecycle. Empty buckets are 0 — not fiction.
    /// </summary>
    [HttpGet("pending")]
    [ProducesResponseType(typeof(PendingApprovalsResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPending(CancellationToken ct)
    {
        // Time entries: Submitted awaiting approve (Phase 2 mobile lifecycle)
        var timeQ = db.Set<TimeEntry>().AsNoTracking().Where(e => !e.IsDeleted && e.Status == TimeEntryStatus.Submitted);
        if (companyContext.IsResolved)
            timeQ = timeQ.Where(e => e.CompanyId == companyContext.CompanyId);
        var timeEntries = await timeQ.CountAsync(ct);

        // Phase 1 types: change orders Pending / UnderReview (honest counts if tables present)
        var coQ = db.Set<ChangeOrder>().AsNoTracking()
            .Where(c => !c.IsDeleted
                        && (c.Status == ChangeOrderStatus.Pending || c.Status == ChangeOrderStatus.UnderReview));
        if (companyContext.IsResolved)
            coQ = coQ.Where(c => c.CompanyId == companyContext.CompanyId);
        var changeOrders = await coQ.CountAsync(ct);

        var total = timeEntries + changeOrders;

        return Ok(new PendingApprovalsResponse(
            Total: total,
            TimeEntries: timeEntries,
            ChangeOrders: changeOrders,
            ExpandedLifecycle: "timeEntries",
            TruthNote:
                "Counts are live database queries for the active company/tenant. Zero means no pending rows — not a hidden queue. Mobile approve path expands time entries only (2.21.3 freeze)."));
    }
}

public record PendingApprovalsResponse(
    int Total,
    int TimeEntries,
    int ChangeOrders,
    string ExpandedLifecycle,
    string TruthNote);
