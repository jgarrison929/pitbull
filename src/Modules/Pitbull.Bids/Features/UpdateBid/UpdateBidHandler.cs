using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Bids.Domain;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Bids.Features.UpdateBid;

public sealed class UpdateBidHandler(PitbullDbContext db)
    : IRequestHandler<UpdateBidCommand, Result<BidDto>>
{
    public async Task<Result<BidDto>> Handle(
        UpdateBidCommand request, CancellationToken cancellationToken)
    {
        var bid = await db.Set<Bid>()
            .Include(b => b.Items)
            .FirstOrDefaultAsync(b => b.Id == request.Id, cancellationToken);

        if (bid is null)
            return Result.Failure<BidDto>("Bid not found", "NOT_FOUND");

        bid.Name = request.Name;
        bid.Number = request.Number;
        bid.Status = request.Status;
        bid.EstimatedValue = request.EstimatedValue;
        bid.BidDate = request.BidDate;
        bid.DueDate = request.DueDate;
        bid.Owner = request.Owner;
        bid.Description = request.Description;

        // Replace items if provided
        if (request.Items is not null)
        {
            // Remove existing items
            db.Set<BidItem>().RemoveRange(bid.Items);
            bid.Items.Clear();

            foreach (var item in request.Items)
            {
                bid.Items.Add(new BidItem
                {
                    Description = item.Description,
                    Category = item.Category,
                    Quantity = item.Quantity,
                    UnitCost = item.UnitCost,
                    TotalCost = item.Quantity * item.UnitCost
                });
            }
        }

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(BidMapper.ToDto(bid));
    }
}
