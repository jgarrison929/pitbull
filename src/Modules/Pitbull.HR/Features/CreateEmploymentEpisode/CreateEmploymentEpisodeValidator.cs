using FluentValidation;

namespace Pitbull.HR.Features.CreateEmploymentEpisode;

public class CreateEmploymentEpisodeValidator : AbstractValidator<CreateEmploymentEpisodeCommand>
{
    public CreateEmploymentEpisodeValidator()
    {
        RuleFor(x => x.EmployeeId)
            .NotEmpty().WithMessage("Employee ID is required");

        RuleFor(x => x.HireDate)
            .NotEmpty().WithMessage("Hire date is required")
            .LessThanOrEqualTo(DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)))
            .WithMessage("Hire date cannot be more than 30 days in the future");

        RuleFor(x => x.UnionDispatchReference)
            .MaximumLength(50).WithMessage("Union dispatch reference cannot exceed 50 characters")
            .When(x => !string.IsNullOrEmpty(x.UnionDispatchReference));

        RuleFor(x => x.JobClassificationAtHire)
            .MaximumLength(100).WithMessage("Job classification cannot exceed 100 characters")
            .When(x => !string.IsNullOrEmpty(x.JobClassificationAtHire));

        RuleFor(x => x.HourlyRateAtHire)
            .GreaterThan(0).WithMessage("Hourly rate must be greater than zero")
            .LessThanOrEqualTo(500).WithMessage("Hourly rate cannot exceed $500")
            .When(x => x.HourlyRateAtHire.HasValue);

        RuleFor(x => x.PositionAtHire)
            .MaximumLength(100).WithMessage("Position cannot exceed 100 characters")
            .When(x => !string.IsNullOrEmpty(x.PositionAtHire));
    }
}
