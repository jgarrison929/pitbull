using FluentValidation;

namespace Pitbull.TimeTracking.Features.UpdateEmployee;

public class UpdateEmployeeValidator : AbstractValidator<UpdateEmployeeCommand>
{
    public UpdateEmployeeValidator()
    {
        RuleFor(x => x.EmployeeId)
            .NotEmpty().WithMessage("Employee ID is required");

        RuleFor(x => x.FirstName)
            .NotEmpty().WithMessage("First name is required")
            .MaximumLength(100).WithMessage("First name cannot exceed 100 characters");

        RuleFor(x => x.LastName)
            .NotEmpty().WithMessage("Last name is required")
            .MaximumLength(100).WithMessage("Last name cannot exceed 100 characters");

        RuleFor(x => x.Email)
            .EmailAddress().WithMessage("Invalid email format")
            .MaximumLength(256).WithMessage("Email cannot exceed 256 characters")
            .When(x => !string.IsNullOrEmpty(x.Email));

        RuleFor(x => x.Phone)
            .MaximumLength(20).WithMessage("Phone number cannot exceed 20 characters")
            .When(x => !string.IsNullOrEmpty(x.Phone));

        RuleFor(x => x.Title)
            .MaximumLength(100).WithMessage("Title cannot exceed 100 characters")
            .When(x => !string.IsNullOrEmpty(x.Title));

        RuleFor(x => x.Classification)
            .IsInEnum().WithMessage("Invalid employee classification");

        RuleFor(x => x.BaseHourlyRate)
            .GreaterThanOrEqualTo(0).WithMessage("Base hourly rate cannot be negative")
            .LessThanOrEqualTo(1000).WithMessage("Base hourly rate cannot exceed 1000");

        RuleFor(x => x.Notes)
            .MaximumLength(2000).WithMessage("Notes cannot exceed 2000 characters")
            .When(x => !string.IsNullOrEmpty(x.Notes));

        // TerminationDate must be after HireDate if both are provided
        RuleFor(x => x.TerminationDate)
            .GreaterThan(x => x.HireDate)
            .When(x => x.HireDate.HasValue && x.TerminationDate.HasValue)
            .WithMessage("Termination date must be after hire date");

        // SupervisorId validation is done in handler (requires DB lookup)
    }
}
