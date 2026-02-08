using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Contracts.Features.CreateChangeOrder;

public sealed class CreateChangeOrderHandler(PitbullDbContext db) 
    : IRequestHandler<CreateChangeOrderCommand, Result<ChangeOrderDto>>
{
    public async Task<Result<ChangeOrderDto>> Handle(
        CreateChangeOrderCommand request, 
        CancellationToken cancellationToken)
    {
        // Verify subcontract exists
        var subcontractExists = await db.Set<Subcontract>()
            .AnyAsync(s => s.Id == request.SubcontractId, cancellationToken);
        
        if (!subcontractExists)
            return Result.Failure<ChangeOrderDto>("Subcontract not found", "SUBCONTRACT_NOT_FOUND");

        // Check for duplicate CO number on this subcontract
        var duplicateExists = await db.Set<ChangeOrder>()
            .AnyAsync(co => co.SubcontractId == request.SubcontractId 
                         && co.ChangeOrderNumber == request.ChangeOrderNumber, 
                     cancellationToken);
        
        if (duplicateExists)
            return Result.Failure<ChangeOrderDto>(
                "Change order number already exists for this subcontract", 
                "DUPLICATE_CO_NUMBER");

        var changeOrder = new ChangeOrder
        {
            SubcontractId = request.SubcontractId,
            ChangeOrderNumber = request.ChangeOrderNumber,
            Title = request.Title,
            Description = request.Description,
            Reason = request.Reason,
            Amount = request.Amount,
            DaysExtension = request.DaysExtension,
            ReferenceNumber = request.ReferenceNumber,
            Status = ChangeOrderStatus.Pending,
            SubmittedDate = DateTime.UtcNow
        };

        db.Set<ChangeOrder>().Add(changeOrder);
        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(MapToDto(changeOrder));
    }

    private static ChangeOrderDto MapToDto(ChangeOrder co) => new(
        co.Id,
        co.SubcontractId,
        co.ChangeOrderNumber,
        co.Title,
        co.Description,
        co.Reason,
        co.Amount,
        co.DaysExtension,
        co.Status,
        co.SubmittedDate,
        co.ApprovedDate,
        co.RejectedDate,
        co.ApprovedBy,
        co.RejectedBy,
        co.RejectionReason,
        co.ReferenceNumber,
        co.CreatedAt
    );
}
