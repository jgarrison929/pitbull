using FluentValidation;

namespace Pitbull.Bids.Features.ConvertBidToProject;

public class ConvertBidToProjectValidator : AbstractValidator<ConvertBidToProjectCommand>
{
    public ConvertBidToProjectValidator()
    {
        RuleFor(x => x.BidId)
            .NotEmpty().WithMessage("Bid ID is required");

        RuleFor(x => x.ProjectNumber)
            .NotEmpty().WithMessage("Project number is required")
            .MaximumLength(50);
    }
}
