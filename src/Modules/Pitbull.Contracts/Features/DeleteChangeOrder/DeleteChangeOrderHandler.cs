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

        // Soft delete
        changeOrder.IsDeleted = true;
        changeOrder.DeletedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(true);
    }
}
