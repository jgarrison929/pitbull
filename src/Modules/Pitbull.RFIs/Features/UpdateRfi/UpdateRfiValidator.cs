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
    }
}
