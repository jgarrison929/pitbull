using FluentValidation;

namespace Pitbull.HR.Features.CreateDeduction;

public class CreateDeductionValidator : AbstractValidator<CreateDeductionCommand>
{
    public CreateDeductionValidator()
    {
        RuleFor(x => x.EmployeeId).NotEmpty();
        RuleFor(x => x.DeductionCode).NotEmpty().MaximumLength(20);
        RuleFor(x => x.Description).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Method).IsInEnum();
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleFor(x => x.MaxPerPeriod).GreaterThan(0).When(x => x.MaxPerPeriod.HasValue);
        RuleFor(x => x.AnnualMax).GreaterThan(0).When(x => x.AnnualMax.HasValue);
        RuleFor(x => x.Priority).InclusiveBetween(1, 100).When(x => x.Priority.HasValue);
        RuleFor(x => x.EmployerMatch).GreaterThanOrEqualTo(0).When(x => x.EmployerMatch.HasValue);
        RuleFor(x => x.EffectiveDate).NotEmpty();
        RuleFor(x => x.CaseNumber).MaximumLength(50).When(x => !string.IsNullOrEmpty(x.CaseNumber));
        RuleFor(x => x.GarnishmentPayee).MaximumLength(200).When(x => !string.IsNullOrEmpty(x.GarnishmentPayee));
        RuleFor(x => x.Notes).MaximumLength(500).When(x => !string.IsNullOrEmpty(x.Notes));
    }
}
