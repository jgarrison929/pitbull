using FluentValidation;

namespace Pitbull.TimeTracking.Features.ApproveTimeEntry;

public class ApproveTimeEntryValidator : AbstractValidator<ApproveTimeEntryCommand>
{
    public ApproveTimeEntryValidator()
    {
        RuleFor(x => x.TimeEntryId)
            .NotEmpty().WithMessage("Time entry ID is required");

        RuleFor(x => x.ApprovedById)
            .NotEmpty().WithMessage("Approver ID is required");

        RuleFor(x => x.Comments)
            .MaximumLength(1000).WithMessage("Comments cannot exceed 1000 characters")
            .When(x => !string.IsNullOrEmpty(x.Comments));
    }
}
