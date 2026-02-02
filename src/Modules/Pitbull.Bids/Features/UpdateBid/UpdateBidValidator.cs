using FluentValidation;

namespace Pitbull.Bids.Features.UpdateBid;

public class UpdateBidValidator : AbstractValidator<UpdateBidCommand>
{
    public UpdateBidValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Bid ID is required");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Bid name is required")
            .MaximumLength(200).WithMessage("Bid name cannot exceed 200 characters");

        RuleFor(x => x.Number)
            .NotEmpty().WithMessage("Bid number is required")
            .MaximumLength(50).WithMessage("Bid number cannot exceed 50 characters");

        RuleFor(x => x.Status)
            .IsInEnum().WithMessage("Invalid bid status");

        RuleFor(x => x.EstimatedValue)
            .GreaterThanOrEqualTo(0).WithMessage("Estimated value cannot be negative");

        RuleFor(x => x.DueDate)
            .GreaterThan(x => x.BidDate)
            .When(x => x.BidDate.HasValue && x.DueDate.HasValue)
            .WithMessage("Due date must be after bid date");
    }
}
