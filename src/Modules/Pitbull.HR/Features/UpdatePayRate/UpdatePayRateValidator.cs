using FluentValidation;

namespace Pitbull.HR.Features.UpdatePayRate;

public class UpdatePayRateValidator : AbstractValidator<UpdatePayRateCommand>
{
    public UpdatePayRateValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Pay rate ID is required");

        RuleFor(x => x.RateType)
            .IsInEnum().WithMessage("Invalid rate type");

        RuleFor(x => x.Amount)
            .GreaterThan(0).WithMessage("Amount must be greater than zero")
            .LessThanOrEqualTo(10000).WithMessage("Amount cannot exceed $10,000/hour");

        RuleFor(x => x.Currency)
            .MaximumLength(3).WithMessage("Currency must be a 3-character code")
            .Matches("^[A-Z]{3}$").WithMessage("Currency must be uppercase (e.g., USD)")
            .When(x => !string.IsNullOrEmpty(x.Currency));

        RuleFor(x => x.EffectiveDate)
            .NotEmpty().WithMessage("Effective date is required");

        RuleFor(x => x.ExpirationDate)
            .GreaterThan(x => x.EffectiveDate)
            .WithMessage("Expiration date must be after effective date")
            .When(x => x.ExpirationDate.HasValue);

        RuleFor(x => x.Description)
            .MaximumLength(200).WithMessage("Description cannot exceed 200 characters")
            .When(x => !string.IsNullOrEmpty(x.Description));

        RuleFor(x => x.ShiftCode)
            .MaximumLength(10).WithMessage("Shift code cannot exceed 10 characters")
            .When(x => !string.IsNullOrEmpty(x.ShiftCode));

        RuleFor(x => x.WorkState)
            .Length(2).WithMessage("Work state must be a 2-character code")
            .Matches("^[A-Z]{2}$").WithMessage("Work state must be uppercase (e.g., CA)")
            .When(x => !string.IsNullOrEmpty(x.WorkState));

        RuleFor(x => x.Priority)
            .InclusiveBetween(1, 100).WithMessage("Priority must be between 1 and 100")
            .When(x => x.Priority.HasValue);

        RuleFor(x => x.FringeRate)
            .GreaterThanOrEqualTo(0).WithMessage("Fringe rate cannot be negative")
            .When(x => x.FringeRate.HasValue);

        RuleFor(x => x.HealthWelfareRate)
            .GreaterThanOrEqualTo(0).WithMessage("Health & welfare rate cannot be negative")
            .When(x => x.HealthWelfareRate.HasValue);

        RuleFor(x => x.PensionRate)
            .GreaterThanOrEqualTo(0).WithMessage("Pension rate cannot be negative")
            .When(x => x.PensionRate.HasValue);

        RuleFor(x => x.TrainingRate)
            .GreaterThanOrEqualTo(0).WithMessage("Training rate cannot be negative")
            .When(x => x.TrainingRate.HasValue);

        RuleFor(x => x.OtherFringeRate)
            .GreaterThanOrEqualTo(0).WithMessage("Other fringe rate cannot be negative")
            .When(x => x.OtherFringeRate.HasValue);

        RuleFor(x => x.Notes)
            .MaximumLength(1000).WithMessage("Notes cannot exceed 1000 characters")
            .When(x => !string.IsNullOrEmpty(x.Notes));
    }
}
