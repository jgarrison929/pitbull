using FluentValidation;

namespace Pitbull.Bids.Features.DeleteBid;

public class DeleteBidValidator : AbstractValidator<DeleteBidCommand>
{
    public DeleteBidValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Bid ID is required");
    }
}
