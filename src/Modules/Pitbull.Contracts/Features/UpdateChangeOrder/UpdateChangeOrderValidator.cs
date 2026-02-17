using FluentValidation;

namespace Pitbull.Contracts.Features.UpdateChangeOrder;

public class UpdateChangeOrderValidator : AbstractValidator<UpdateChangeOrderCommand>
{
    public UpdateChangeOrderValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Change order ID is required");

        RuleFor(x => x.Number)
            .NotEmpty().WithMessage("Change order number is required")
            .MaximumLength(50).WithMessage("Change order number cannot exceed 50 characters");

        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Title is required")
            .MaximumLength(200).WithMessage("Title cannot exceed 200 characters");

        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Description is required")
            .MaximumLength(4000).WithMessage("Description cannot exceed 4000 characters");

        RuleFor(x => x.ScheduleImpactDays)
            .GreaterThanOrEqualTo(0).WithMessage("Days extension cannot be negative")
            .When(x => x.ScheduleImpactDays.HasValue);

        RuleFor(x => x.Status)
            .IsInEnum().WithMessage("Invalid change order status");

        RuleFor(x => x.RequestedBy)
            .MaximumLength(200).WithMessage("Requested by cannot exceed 200 characters")
            .When(x => !string.IsNullOrEmpty(x.RequestedBy));

        RuleFor(x => x.CostImpact)
            .GreaterThanOrEqualTo(0).WithMessage("Cost impact cannot be negative")
            .When(x => x.CostImpact.HasValue);
    }
}
