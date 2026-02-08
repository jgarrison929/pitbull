using FluentValidation;

namespace Pitbull.Contracts.Features.CreatePaymentApplication;

public class CreatePaymentApplicationValidator : AbstractValidator<CreatePaymentApplicationCommand>
{
    public CreatePaymentApplicationValidator()
    {
        RuleFor(x => x.SubcontractId)
            .NotEmpty().WithMessage("Subcontract ID is required");

        RuleFor(x => x.PeriodStart)
            .NotEmpty().WithMessage("Period start date is required");

        RuleFor(x => x.PeriodEnd)
            .NotEmpty().WithMessage("Period end date is required")
            .GreaterThan(x => x.PeriodStart).WithMessage("Period end must be after period start");

        RuleFor(x => x.WorkCompletedThisPeriod)
            .GreaterThanOrEqualTo(0).WithMessage("Work completed cannot be negative");

        RuleFor(x => x.StoredMaterials)
            .GreaterThanOrEqualTo(0).WithMessage("Stored materials cannot be negative");

        RuleFor(x => x.InvoiceNumber)
            .MaximumLength(100).WithMessage("Invoice number cannot exceed 100 characters")
            .When(x => !string.IsNullOrEmpty(x.InvoiceNumber));

        RuleFor(x => x.Notes)
            .MaximumLength(4000).WithMessage("Notes cannot exceed 4000 characters")
            .When(x => !string.IsNullOrEmpty(x.Notes));
    }
}
