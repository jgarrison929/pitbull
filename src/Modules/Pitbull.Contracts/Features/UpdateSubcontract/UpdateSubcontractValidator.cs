using FluentValidation;

namespace Pitbull.Contracts.Features.UpdateSubcontract;

public class UpdateSubcontractValidator : AbstractValidator<UpdateSubcontractCommand>
{
    public UpdateSubcontractValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Subcontract ID is required");

        RuleFor(x => x.SubcontractNumber)
            .NotEmpty().WithMessage("Subcontract number is required")
            .MaximumLength(50).WithMessage("Subcontract number cannot exceed 50 characters");

        RuleFor(x => x.SubcontractorName)
            .NotEmpty().WithMessage("Subcontractor name is required")
            .MaximumLength(200).WithMessage("Subcontractor name cannot exceed 200 characters");

        RuleFor(x => x.ScopeOfWork)
            .NotEmpty().WithMessage("Scope of work is required")
            .MaximumLength(4000).WithMessage("Scope of work cannot exceed 4000 characters");

        RuleFor(x => x.OriginalValue)
            .GreaterThan(0).WithMessage("Original value must be greater than zero");

        RuleFor(x => x.RetainagePercent)
            .InclusiveBetween(0, 100).WithMessage("Retainage percent must be between 0 and 100");

        RuleFor(x => x.Status)
            .IsInEnum().WithMessage("Invalid subcontract status");

        // Optional fields
        RuleFor(x => x.SubcontractorContact)
            .MaximumLength(200).WithMessage("Contact name cannot exceed 200 characters")
            .When(x => !string.IsNullOrEmpty(x.SubcontractorContact));

        RuleFor(x => x.SubcontractorEmail)
            .EmailAddress().WithMessage("Invalid email format")
            .MaximumLength(200).WithMessage("Email cannot exceed 200 characters")
            .When(x => !string.IsNullOrEmpty(x.SubcontractorEmail));

        RuleFor(x => x.SubcontractorPhone)
            .MaximumLength(50).WithMessage("Phone number cannot exceed 50 characters")
            .When(x => !string.IsNullOrEmpty(x.SubcontractorPhone));

        RuleFor(x => x.SubcontractorAddress)
            .MaximumLength(500).WithMessage("Address cannot exceed 500 characters")
            .When(x => !string.IsNullOrEmpty(x.SubcontractorAddress));

        RuleFor(x => x.TradeCode)
            .MaximumLength(100).WithMessage("Trade code cannot exceed 100 characters")
            .When(x => !string.IsNullOrEmpty(x.TradeCode));

        RuleFor(x => x.LicenseNumber)
            .MaximumLength(100).WithMessage("License number cannot exceed 100 characters")
            .When(x => !string.IsNullOrEmpty(x.LicenseNumber));

        RuleFor(x => x.Notes)
            .MaximumLength(4000).WithMessage("Notes cannot exceed 4000 characters")
            .When(x => !string.IsNullOrEmpty(x.Notes));

        // Date validation
        RuleFor(x => x.CompletionDate)
            .GreaterThan(x => x.StartDate)
            .When(x => x.StartDate.HasValue && x.CompletionDate.HasValue)
            .WithMessage("Completion date must be after start date");
    }
}
