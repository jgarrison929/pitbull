using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Core.Services;
using Pitbull.Core.Logging;

namespace Pitbull.Api.Features.Workflow;

public sealed class WorkflowTransitionService(
    PitbullDbContext db,
    ITenantContext tenantContext,
    ICompanyContext companyContext,
    ILogger<WorkflowTransitionService> logger) : IWorkflowTransitionService
{
    private static readonly HashSet<string> ValidEntityTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "TimeEntry", "Submittal", "RFI", "ChangeOrder", "PaymentApplication", "VendorInvoice", "BillingApplication", "DailyReport"
    };

    public async Task RecordTransitionAsync(
        string entityType,
        Guid entityId,
        string? fromStatus,
        string toStatus,
        Guid changedByUserId,
        string? changedByName,
        string? comment,
        CancellationToken ct)
    {
        if (!ValidEntityTypes.Contains(entityType))
            throw new ArgumentException($"Unknown entity type: {entityType}");

        if (fromStatus == toStatus)
            return; // No-op for same-status transitions

        var transition = new WorkflowTransition
        {
            TenantId = tenantContext.TenantId,
            CompanyId = companyContext.CompanyId,
            EntityType = entityType,
            EntityId = entityId,
            FromStatus = fromStatus,
            ToStatus = toStatus,
            ChangedByUserId = changedByUserId,
            ChangedAt = DateTime.UtcNow,
            Comment = comment,
            ChangedByName = changedByName
        };

        db.Set<WorkflowTransition>().Add(transition);
        await db.SaveChangesAsync(ct);

        logger.LogInformation(
            "Workflow transition: {EntityType} {EntityId} from {From} to {To} by {User}",
            LogSafe.Text(entityType), entityId, LogSafe.Text(fromStatus ?? "(initial)"), LogSafe.Text(toStatus), LogSafe.Text(changedByName ?? changedByUserId.ToString()));
    }

    public async Task<List<WorkflowTransitionDto>> GetTransitionsAsync(
        string entityType,
        Guid entityId,
        CancellationToken ct)
    {
        var transitions = await db.Set<WorkflowTransition>()
            .AsNoTracking()
            .Where(wt => wt.EntityType == entityType
                && wt.EntityId == entityId
                && wt.CompanyId == companyContext.CompanyId)
            .OrderBy(wt => wt.ChangedAt)
            .Select(wt => new WorkflowTransitionDto(
                wt.Id,
                wt.EntityType,
                wt.EntityId,
                wt.FromStatus,
                wt.ToStatus,
                wt.ChangedByUserId,
                wt.ChangedByName,
                wt.ChangedAt,
                wt.Comment))
            .ToListAsync(ct);

        return transitions;
    }
}

public sealed record WorkflowTransitionDto(
    Guid Id,
    string EntityType,
    Guid EntityId,
    string? FromStatus,
    string ToStatus,
    Guid ChangedByUserId,
    string? ChangedByName,
    DateTime ChangedAt,
    string? Comment);
