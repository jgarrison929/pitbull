using FluentValidation;

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

        RuleFor(x => x.Reason)
            .MaximumLength(500).WithMessage("Reason cannot exceed 500 characters")
            .When(x => !string.IsNullOrEmpty(x.Reason));

        RuleFor(x => x.DaysExtension)
            .GreaterThanOrEqualTo(0).WithMessage("Days extension cannot be negative")
            .When(x => x.DaysExtension.HasValue);

        RuleFor(x => x.Status)
            .IsInEnum().WithMessage("Invalid change order status");

        RuleFor(x => x.ReferenceNumber)
            .MaximumLength(100).WithMessage("Reference number cannot exceed 100 characters")
            .When(x => !string.IsNullOrEmpty(x.ReferenceNumber));
    }
}
