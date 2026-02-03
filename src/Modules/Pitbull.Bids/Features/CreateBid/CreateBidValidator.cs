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

        // Optional fields with validation
        RuleFor(x => x.Description)
            .MaximumLength(1000).WithMessage("Description cannot exceed 1000 characters")
            .When(x => !string.IsNullOrEmpty(x.Description));

        RuleFor(x => x.Owner)
            .MaximumLength(200).WithMessage("Owner name cannot exceed 200 characters")
            .When(x => !string.IsNullOrEmpty(x.Owner));

        // Date validation
        RuleFor(x => x.DueDate)
            .GreaterThan(x => x.BidDate)
            .When(x => x.BidDate.HasValue && x.DueDate.HasValue)
            .WithMessage("Due date must be after bid date");

        RuleFor(x => x.BidDate)
            .LessThanOrEqualTo(DateTime.UtcNow.AddYears(1))
            .When(x => x.BidDate.HasValue)
            .WithMessage("Bid date cannot be more than a year in the future");

        // Bid items validation
        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.Description)
                .NotEmpty().WithMessage("Bid item description is required")
                .MaximumLength(500).WithMessage("Bid item description cannot exceed 500 characters");
            
            item.RuleFor(i => i.Category)
                .IsInEnum().WithMessage("Invalid bid item category");
            
            item.RuleFor(i => i.Quantity)
                .GreaterThan(0).WithMessage("Quantity must be greater than 0");
            
            item.RuleFor(i => i.UnitCost)
                .GreaterThanOrEqualTo(0).WithMessage("Unit cost cannot be negative");
        }).When(x => x.Items != null && x.Items.Any());
    }
}
