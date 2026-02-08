using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Contracts.Features.DeleteChangeOrder;

public sealed class DeleteChangeOrderHandler(PitbullDbContext db) 
    : IRequestHandler<DeleteChangeOrderCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(
        DeleteChangeOrderCommand request, 
        CancellationToken cancellationToken)
    {
        var changeOrder = await db.Set<ChangeOrder>()
            .FirstOrDefaultAsync(co => co.Id == request.Id, cancellationToken);

        if (changeOrder is null)
            return Result.Failure<bool>("Change order not found", "NOT_FOUND");

        // Can only delete Pending or Rejected change orders
        if (changeOrder.Status == ChangeOrderStatus.Approved)
            return Result.Failure<bool>("Cannot delete an approved change order", "CANNOT_DELETE");

        // Hard delete for non-approved
        db.Set<ChangeOrder>().Remove(changeOrder);

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(true);
    }
}
