using FluentValidation;

namespace Pitbull.Payroll.Features.CreatePayPeriod;

public class CreatePayPeriodValidator : AbstractValidator<CreatePayPeriodCommand>
{
    public CreatePayPeriodValidator()
    {
        RuleFor(x => x.StartDate).NotEmpty();
        RuleFor(x => x.EndDate).NotEmpty().GreaterThan(x => x.StartDate)
            .WithMessage("End date must be after start date");
        RuleFor(x => x.PayDate).NotEmpty().GreaterThanOrEqualTo(x => x.EndDate)
            .WithMessage("Pay date must be on or after end date");
        RuleFor(x => x.Frequency).IsInEnum();
        RuleFor(x => x.Notes).MaximumLength(500).When(x => !string.IsNullOrEmpty(x.Notes));
    }
}
