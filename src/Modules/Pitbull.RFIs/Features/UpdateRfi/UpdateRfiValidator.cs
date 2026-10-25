using FluentValidation;

namespace Pitbull.RFIs.Features.UpdateRfi;

public class UpdateRfiValidator : AbstractValidator<UpdateRfiCommand>
{
    public UpdateRfiValidator()
    {
        RuleFor(x => x.Id).NotEmpty().WithMessage("RFI ID is required");
        RuleFor(x => x.ProjectId).NotEmpty().WithMessage("Project ID is required");
        RuleFor(x => x.Subject)
            .NotEmpty().WithMessage("Subject is required")
            .MaximumLength(500).WithMessage("Subject cannot exceed 500 characters");
        RuleFor(x => x.Question)
            .NotEmpty().WithMessage("Question is required")
            .MaximumLength(5000).WithMessage("Question cannot exceed 5000 characters");
        RuleFor(x => x.Answer)
            .MaximumLength(5000).WithMessage("Answer cannot exceed 5000 characters")
            .When(x => !string.IsNullOrEmpty(x.Answer));
        RuleFor(x => x.Status).IsInEnum().WithMessage("Invalid status value");
        RuleFor(x => x.Priority).IsInEnum().WithMessage("Invalid priority value");

        RuleFor(x => x.AssignedToName)
            .MaximumLength(200).WithMessage("Assigned to name cannot exceed 200 characters")
            .When(x => !string.IsNullOrEmpty(x.AssignedToName));

        RuleFor(x => x.BallInCourtName)
            .MaximumLength(200).WithMessage("Ball in court name cannot exceed 200 characters")
            .When(x => !string.IsNullOrEmpty(x.BallInCourtName));

        RuleFor(x => x.SpecSection)
            .MaximumLength(200).WithMessage("Spec section cannot exceed 200 characters")
            .When(x => !string.IsNullOrEmpty(x.SpecSection));

        RuleFor(x => x.EstimatedCostImpact)
            .GreaterThanOrEqualTo(0).WithMessage("Estimated cost impact cannot be negative")
            .LessThanOrEqualTo(1_000_000_000m).WithMessage("Estimated cost impact cannot exceed 1,000,000,000")
            .When(x => x.EstimatedCostImpact.HasValue);

        RuleFor(x => x.EstimatedDelayDays)
            .GreaterThanOrEqualTo(0).WithMessage("Estimated delay days cannot be negative")
            .LessThanOrEqualTo(3650).WithMessage("Estimated delay days cannot exceed 3650")
            .When(x => x.EstimatedDelayDays.HasValue);

        RuleForEach(x => x.DrawingReferences)
            .MaximumLength(100).WithMessage("Each drawing reference cannot exceed 100 characters")
            .When(x => x.DrawingReferences is not null);

        RuleFor(x => x.DrawingReferences)
            .Must(list => list is null || list.Count <= 50)
            .WithMessage("Drawing references cannot exceed 50 items");
    }
}
