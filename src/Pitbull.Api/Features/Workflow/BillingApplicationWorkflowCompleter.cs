using Microsoft.EntityFrameworkCore;
using Pitbull.Billing.Domain;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.Services;

namespace Pitbull.Api.Features.Workflow;

public sealed class BillingApplicationWorkflowCompleter(PitbullDbContext db) : IWorkflowEntityCompleter
{
    public string EntityType => "BillingApplication";

    public async Task<Result> ApplyApprovedStatusAsync(Guid entityId, string approvedStatus, CancellationToken ct)
    {
        return await ApplyStatusAsync(entityId, approvedStatus, null, ct);
    }

    public async Task<Result> ApplyRejectedStatusAsync(
        Guid entityId, string rejectedStatus, string? comment, CancellationToken ct)
    {
        return await ApplyStatusAsync(entityId, rejectedStatus, comment, ct);
    }

    private async Task<Result> ApplyStatusAsync(
        Guid entityId, string targetStatus, string? comment, CancellationToken ct)
    {
        var app = await db.Set<BillingApplication>()
            .FirstOrDefaultAsync(a => a.Id == entityId, ct);

        if (app is null)
            return Result.Failure("Billing application not found", "NOT_FOUND");

        if (!Enum.TryParse<BillingApplicationStatus>(targetStatus, out var newStatus))
            return Result.Failure($"Invalid status: {targetStatus}", "INVALID_STATUS");

        if (!BillingApplicationStatusTransitions.IsValid(app.Status, newStatus))
            return Result.Failure(
                $"Cannot transition billing application from {app.Status} to {newStatus}",
                "INVALID_STATUS_TRANSITION");

        app.Status = newStatus;

        if (newStatus == BillingApplicationStatus.PmRejected && !string.IsNullOrWhiteSpace(comment))
        {
            app.InternalNotes = string.IsNullOrWhiteSpace(app.InternalNotes)
                ? $"Rejection: {comment}"
                : $"{app.InternalNotes}\nRejection: {comment}";
        }

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}