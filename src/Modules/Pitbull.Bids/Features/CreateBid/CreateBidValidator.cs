using FluentValidation;

namespace Pitbull.Bids.Features.CreateBid;

public class CreateBidValidator : AbstractValidator<CreateBidCommand>
{
    public CreateBidValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Bid name is required")
            .MaximumLength(200).WithMessage("Bid name cannot exceed 200 characters");

        RuleFor(x => x.Number)
            .NotEmpty().WithMessage("Bid number is required")
            .MaximumLength(50).WithMessage("Bid number cannot exceed 50 characters");

        RuleFor(x => x.EstimatedValue)
            .GreaterThanOrEqualTo(0).WithMessage("Estimated value cannot be negative");

        RuleFor(x => x.DueDate)
            .GreaterThan(x => x.BidDate)
            .When(x => x.BidDate.HasValue && x.DueDate.HasValue)
            .WithMessage("Due date must be after bid date");

        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.Description).NotEmpty().MaximumLength(500);
            item.RuleFor(i => i.Quantity).GreaterThan(0);
            item.RuleFor(i => i.UnitCost).GreaterThanOrEqualTo(0);
        }).When(x => x.Items != null);
    }
}
