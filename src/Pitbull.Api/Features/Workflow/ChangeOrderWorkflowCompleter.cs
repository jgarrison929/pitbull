using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.UpdateChangeOrder;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Services;

namespace Pitbull.Api.Features.Workflow;

public sealed class ChangeOrderWorkflowCompleter(PitbullDbContext db) : IWorkflowEntityCompleter
{
    public string EntityType => "ChangeOrder";

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
        var changeOrder = await db.Set<ChangeOrder>()
            .FirstOrDefaultAsync(co => co.Id == entityId, ct);

        if (changeOrder is null)
            return Result.Failure("Change order not found", "NOT_FOUND");

        if (!Enum.TryParse<ChangeOrderStatus>(targetStatus, out var newStatus))
            return Result.Failure($"Invalid status: {targetStatus}", "INVALID_STATUS");

        if (!ChangeOrderStatusTransitions.IsValid(changeOrder.Status, newStatus))
            return Result.Failure(
                $"Cannot transition from {changeOrder.Status} to {newStatus}",
                "INVALID_STATUS_TRANSITION");

        if (newStatus == ChangeOrderStatus.Approved)
        {
            var subcontract = await db.Set<Subcontract>()
                .FirstOrDefaultAsync(s => s.Id == changeOrder.SubcontractId, ct);

            if (subcontract is null)
                return Result.Failure("Subcontract not found", "SUBCONTRACT_NOT_FOUND");

            if (subcontract.CurrentValue + changeOrder.Amount < 0)
                return Result.Failure("Change order would reduce contract sum below zero", "NEGATIVE_CONTRACT_SUM");

            subcontract.CurrentValue += changeOrder.Amount;
            changeOrder.ApprovedDate ??= DateTime.UtcNow;
        }
        else if (newStatus == ChangeOrderStatus.Rejected)
        {
            changeOrder.RejectedDate ??= DateTime.UtcNow;
            if (!string.IsNullOrWhiteSpace(comment))
                changeOrder.RejectionReason = comment;
        }

        changeOrder.Status = newStatus;
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}