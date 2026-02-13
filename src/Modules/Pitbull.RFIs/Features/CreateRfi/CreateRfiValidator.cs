using FluentValidation;

namespace Pitbull.RFIs.Features.CreateRfi;

public class CreateRfiValidator : AbstractValidator<CreateRfiCommand>
{
    public CreateRfiValidator()
    {
        RuleFor(x => x.ProjectId)
            .NotEmpty().WithMessage("Project ID is required");

        RuleFor(x => x.Subject)
            .NotEmpty().WithMessage("Subject is required")
            .MaximumLength(500).WithMessage("Subject cannot exceed 500 characters");

        RuleFor(x => x.Question)
            .NotEmpty().WithMessage("Question is required")
            .MaximumLength(5000).WithMessage("Question cannot exceed 5000 characters");

        RuleFor(x => x.Priority)
            .IsInEnum().WithMessage("Invalid priority value");

        RuleFor(x => x.AssignedToName)
            .MaximumLength(200).WithMessage("Assigned to name cannot exceed 200 characters")
            .When(x => !string.IsNullOrEmpty(x.AssignedToName));
    }
}
