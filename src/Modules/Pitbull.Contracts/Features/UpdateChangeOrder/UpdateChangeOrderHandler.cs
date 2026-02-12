using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreateChangeOrder;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Contracts.Features.UpdateChangeOrder;

public sealed class UpdateChangeOrderHandler(PitbullDbContext db)
    : IRequestHandler<UpdateChangeOrderCommand, Result<ChangeOrderDto>>
{
    public async Task<Result<ChangeOrderDto>> Handle(
        UpdateChangeOrderCommand request,
        CancellationToken cancellationToken)
    {
        var changeOrder = await db.Set<ChangeOrder>()
            .FirstOrDefaultAsync(co => co.Id == request.Id, cancellationToken);

        if (changeOrder is null)
            return Result.Failure<ChangeOrderDto>("Change order not found", "NOT_FOUND");

        // Check for duplicate CO number if changed
        if (changeOrder.ChangeOrderNumber != request.ChangeOrderNumber)
        {
            var duplicateExists = await db.Set<ChangeOrder>()
                .AnyAsync(co => co.SubcontractId == changeOrder.SubcontractId
                             && co.ChangeOrderNumber == request.ChangeOrderNumber
                             && co.Id != request.Id,
                         cancellationToken);

            if (duplicateExists)
                return Result.Failure<ChangeOrderDto>(
                    "Change order number already exists for this subcontract",
                    "DUPLICATE_CO_NUMBER");
        }

        // Track status transitions for date tracking
        var oldStatus = changeOrder.Status;
        var newStatus = request.Status;

        // Update fields
        changeOrder.ChangeOrderNumber = request.ChangeOrderNumber;
        changeOrder.Title = request.Title;
        changeOrder.Description = request.Description;
        changeOrder.Reason = request.Reason;
        changeOrder.Amount = request.Amount;
        changeOrder.DaysExtension = request.DaysExtension;
        changeOrder.Status = request.Status;
        changeOrder.ReferenceNumber = request.ReferenceNumber;

        // Set approval/rejection dates on status change
        if (oldStatus != newStatus)
        {
            if (newStatus == ChangeOrderStatus.Approved && !changeOrder.ApprovedDate.HasValue)
                changeOrder.ApprovedDate = DateTime.UtcNow;
            else if (newStatus == ChangeOrderStatus.Rejected && !changeOrder.RejectedDate.HasValue)
                changeOrder.RejectedDate = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(new ChangeOrderDto(
            changeOrder.Id,
            changeOrder.SubcontractId,
            changeOrder.ChangeOrderNumber,
            changeOrder.Title,
            changeOrder.Description,
            changeOrder.Reason,
            changeOrder.Amount,
            changeOrder.DaysExtension,
            changeOrder.Status,
            changeOrder.SubmittedDate,
            changeOrder.ApprovedDate,
            changeOrder.RejectedDate,
            changeOrder.ApprovedBy,
            changeOrder.RejectedBy,
            changeOrder.RejectionReason,
            changeOrder.ReferenceNumber,
            changeOrder.CreatedAt
        ));
    }
}
