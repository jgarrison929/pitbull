using FluentValidation;

namespace Pitbull.TimeTracking.Features.RejectTimeEntry;

public class RejectTimeEntryValidator : AbstractValidator<RejectTimeEntryCommand>
{
    public RejectTimeEntryValidator()
    {
        RuleFor(x => x.TimeEntryId)
            .NotEmpty().WithMessage("Time entry ID is required");

        RuleFor(x => x.RejectedById)
            .NotEmpty().WithMessage("Reviewer ID is required");

        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("Rejection reason is required")
            .MaximumLength(1000).WithMessage("Rejection reason cannot exceed 1000 characters");
    }
}
