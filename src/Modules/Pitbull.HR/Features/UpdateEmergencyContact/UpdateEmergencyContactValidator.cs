using FluentValidation;

namespace Pitbull.HR.Features.UpdateEmergencyContact;

public class UpdateEmergencyContactValidator : AbstractValidator<UpdateEmergencyContactCommand>
{
    public UpdateEmergencyContactValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Emergency contact ID is required");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Contact name is required")
            .MaximumLength(100).WithMessage("Contact name cannot exceed 100 characters");

        RuleFor(x => x.Relationship)
            .NotEmpty().WithMessage("Relationship is required")
            .MaximumLength(50).WithMessage("Relationship cannot exceed 50 characters");

        RuleFor(x => x.PrimaryPhone)
            .NotEmpty().WithMessage("Primary phone is required")
            .MaximumLength(20).WithMessage("Phone number cannot exceed 20 characters")
            .Matches(@"^[\d\s\-\+\(\)\.]+$").WithMessage("Invalid phone number format");

        RuleFor(x => x.SecondaryPhone)
            .MaximumLength(20).WithMessage("Phone number cannot exceed 20 characters")
            .Matches(@"^[\d\s\-\+\(\)\.]+$").WithMessage("Invalid phone number format")
            .When(x => !string.IsNullOrEmpty(x.SecondaryPhone));

        RuleFor(x => x.Email)
            .MaximumLength(100).WithMessage("Email cannot exceed 100 characters")
            .EmailAddress().WithMessage("Invalid email format")
            .When(x => !string.IsNullOrEmpty(x.Email));

        RuleFor(x => x.Priority)
            .InclusiveBetween(1, 10).WithMessage("Priority must be between 1 and 10")
            .When(x => x.Priority.HasValue);

        RuleFor(x => x.Notes)
            .MaximumLength(500).WithMessage("Notes cannot exceed 500 characters")
            .When(x => !string.IsNullOrEmpty(x.Notes));
    }
}
