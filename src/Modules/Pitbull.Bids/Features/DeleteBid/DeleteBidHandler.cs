using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Bids.Domain;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Bids.Features.DeleteBid;

public sealed class DeleteBidHandler(PitbullDbContext db)
    : IRequestHandler<DeleteBidCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(
        DeleteBidCommand request, CancellationToken cancellationToken)
    {
        var bid = await db.Set<Bid>()
            .FirstOrDefaultAsync(b => b.Id == request.Id && !b.IsDeleted, cancellationToken);

        if (bid is null)
            return Result.Failure<bool>("Bid not found", "NOT_FOUND");

        // Perform soft delete
        bid.IsDeleted = true;
        bid.DeletedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(true);
    }
}