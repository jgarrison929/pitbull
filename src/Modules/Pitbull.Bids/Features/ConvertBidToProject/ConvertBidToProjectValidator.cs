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

        RuleFor(x => x.ProjectName)
            .MaximumLength(200).When(x => x.ProjectName != null);

        RuleFor(x => x.Description)
            .MaximumLength(2000).When(x => x.Description != null);

        RuleFor(x => x.ProjectType)
            .InclusiveBetween(0, 6).WithMessage("Invalid project type");

        RuleForEach(x => x.CostCodeMappings).ChildRules(mapping =>
        {
            mapping.RuleFor(m => m.BidItemId)
                .NotEmpty().WithMessage("Bid item ID is required for cost code mapping");
            mapping.RuleFor(m => m.CostCode)
                .NotEmpty().WithMessage("Cost code is required")
                .MaximumLength(50);
        }).When(x => x.CostCodeMappings != null);
    }
}
