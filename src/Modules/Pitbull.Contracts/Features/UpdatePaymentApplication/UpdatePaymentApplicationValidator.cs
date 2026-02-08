using FluentValidation;

namespace Pitbull.Contracts.Features.UpdatePaymentApplication;

public class UpdatePaymentApplicationValidator : AbstractValidator<UpdatePaymentApplicationCommand>
{
    public UpdatePaymentApplicationValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Payment application ID is required");

        RuleFor(x => x.WorkCompletedThisPeriod)
            .GreaterThanOrEqualTo(0).WithMessage("Work completed cannot be negative");

        RuleFor(x => x.StoredMaterials)
            .GreaterThanOrEqualTo(0).WithMessage("Stored materials cannot be negative");

        RuleFor(x => x.Status)
            .IsInEnum().WithMessage("Invalid payment application status");

        RuleFor(x => x.ApprovedAmount)
            .GreaterThanOrEqualTo(0).WithMessage("Approved amount cannot be negative")
            .When(x => x.ApprovedAmount.HasValue);

        RuleFor(x => x.ApprovedBy)
            .MaximumLength(200).WithMessage("Approved by cannot exceed 200 characters")
            .When(x => !string.IsNullOrEmpty(x.ApprovedBy));

        RuleFor(x => x.InvoiceNumber)
            .MaximumLength(100).WithMessage("Invoice number cannot exceed 100 characters")
            .When(x => !string.IsNullOrEmpty(x.InvoiceNumber));

        RuleFor(x => x.CheckNumber)
            .MaximumLength(100).WithMessage("Check number cannot exceed 100 characters")
            .When(x => !string.IsNullOrEmpty(x.CheckNumber));

        RuleFor(x => x.Notes)
            .MaximumLength(4000).WithMessage("Notes cannot exceed 4000 characters")
            .When(x => !string.IsNullOrEmpty(x.Notes));
    }
}
