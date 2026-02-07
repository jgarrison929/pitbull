using FluentValidation;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features.UpdateTimeEntry;

public class UpdateTimeEntryValidator : AbstractValidator<UpdateTimeEntryCommand>
{
    public UpdateTimeEntryValidator()
    {
        RuleFor(x => x.TimeEntryId)
            .NotEmpty().WithMessage("Time entry ID is required");

        RuleFor(x => x.RegularHours)
            .GreaterThanOrEqualTo(0).WithMessage("Regular hours cannot be negative")
            .LessThanOrEqualTo(24).WithMessage("Regular hours cannot exceed 24")
            .When(x => x.RegularHours.HasValue);

        RuleFor(x => x.OvertimeHours)
            .GreaterThanOrEqualTo(0).WithMessage("Overtime hours cannot be negative")
            .LessThanOrEqualTo(24).WithMessage("Overtime hours cannot exceed 24")
            .When(x => x.OvertimeHours.HasValue);

        RuleFor(x => x.DoubletimeHours)
            .GreaterThanOrEqualTo(0).WithMessage("Doubletime hours cannot be negative")
            .LessThanOrEqualTo(24).WithMessage("Doubletime hours cannot exceed 24")
            .When(x => x.DoubletimeHours.HasValue);

        RuleFor(x => x.Description)
            .MaximumLength(500).WithMessage("Description cannot exceed 500 characters")
            .When(x => x.Description is not null);

        RuleFor(x => x.ApproverNotes)
            .MaximumLength(1000).WithMessage("Approver notes cannot exceed 1000 characters")
            .When(x => x.ApproverNotes is not null);

        RuleFor(x => x.NewStatus)
            .IsInEnum().WithMessage("Invalid time entry status")
            .When(x => x.NewStatus.HasValue);

        // ApproverId is required when changing to Approved or Rejected status
        RuleFor(x => x.ApproverId)
            .NotEmpty().WithMessage("Approver ID is required when approving or rejecting")
            .When(x => x.NewStatus == TimeEntryStatus.Approved || x.NewStatus == TimeEntryStatus.Rejected);
    }
}
