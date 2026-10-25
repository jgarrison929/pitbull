using FluentValidation;
using Pitbull.Contracts.Features.CreateChangeOrder;

namespace Pitbull.Contracts.Features.UpdateChangeOrder;

public class UpdateChangeOrderValidator : AbstractValidator<UpdateChangeOrderCommand>
{
    public UpdateChangeOrderValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Change order ID is required");

        RuleFor(x => x.ChangeOrderNumber)
            .NotEmpty().WithMessage("Change order number is required")
            .MaximumLength(50).WithMessage("Change order number cannot exceed 50 characters");

        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Title is required")
            .MaximumLength(200).WithMessage("Title cannot exceed 200 characters");

        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Description is required")
            .MaximumLength(4000).WithMessage("Description cannot exceed 4000 characters");

        RuleFor(x => x.Amount)
            .Must(a => Math.Abs(a) <= CreateChangeOrderValidator.MaxAmount)
            .WithMessage("Amount absolute value cannot exceed 1,000,000,000");

        RuleFor(x => x.DaysExtension)
            .GreaterThanOrEqualTo(0).WithMessage("Days extension cannot be negative")
            .LessThanOrEqualTo(CreateChangeOrderValidator.MaxDaysExtension)
            .WithMessage($"Days extension cannot exceed {CreateChangeOrderValidator.MaxDaysExtension}")
            .When(x => x.DaysExtension.HasValue);

        RuleFor(x => x.ScheduleImpactDays)
            .GreaterThanOrEqualTo(0).WithMessage("Days extension cannot be negative")
            .LessThanOrEqualTo(CreateChangeOrderValidator.MaxDaysExtension)
            .WithMessage($"Schedule impact days cannot exceed {CreateChangeOrderValidator.MaxDaysExtension}")
            .When(x => x.ScheduleImpactDays.HasValue);

        RuleFor(x => x.Status)
            .IsInEnum().WithMessage("Invalid change order status");

        RuleFor(x => x.ReferenceNumber)
            .MaximumLength(100).WithMessage("Reference number cannot exceed 100 characters")
            .When(x => !string.IsNullOrEmpty(x.ReferenceNumber));

        RuleFor(x => x.RequestedBy)
            .MaximumLength(200).WithMessage("Requested by cannot exceed 200 characters")
            .When(x => !string.IsNullOrEmpty(x.RequestedBy));

        RuleFor(x => x.CostImpact)
            .GreaterThanOrEqualTo(0).WithMessage("Cost impact cannot be negative")
            .LessThanOrEqualTo(CreateChangeOrderValidator.MaxAmount)
            .WithMessage("Cost impact cannot exceed 1,000,000,000")
            .When(x => x.CostImpact.HasValue);
    }
}
