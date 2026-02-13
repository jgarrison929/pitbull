using Pitbull.Bids.Features.Shared;
using MediatR;
using Pitbull.Bids.Domain;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Bids.Features.CreateBid;

public sealed class CreateBidHandler(PitbullDbContext db)
    : IRequestHandler<CreateBidCommand, Result<BidDto>>
{
    public async Task<Result<BidDto>> Handle(
        CreateBidCommand request, CancellationToken cancellationToken)
    {
        var bid = new Bid
        {
            Name = request.Name,
            Number = request.Number,
            Status = BidStatus.Draft,
            EstimatedValue = request.EstimatedValue,
            BidDate = request.BidDate,
            DueDate = request.DueDate,
            Owner = request.Owner,
            Description = request.Description
        };

        if (request.Items is { Count: > 0 })
        {
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

        db.Set<Bid>().Add(bid);
        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(BidMapper.ToDto(bid));
    }
}
