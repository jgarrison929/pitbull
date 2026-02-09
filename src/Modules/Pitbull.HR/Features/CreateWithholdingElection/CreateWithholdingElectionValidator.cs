using FluentValidation;

namespace Pitbull.HR.Features.CreateWithholdingElection;

public class CreateWithholdingElectionValidator : AbstractValidator<CreateWithholdingElectionCommand>
{
    private static readonly HashSet<string> ValidStates = new(StringComparer.OrdinalIgnoreCase)
    {
        "FEDERAL", "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
        "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI",
        "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND",
        "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA",
        "WA", "WV", "WI", "WY", "DC", "PR"
    };

    public CreateWithholdingElectionValidator()
    {
        RuleFor(x => x.EmployeeId).NotEmpty();
        
        RuleFor(x => x.TaxJurisdiction)
            .NotEmpty().WithMessage("Tax jurisdiction is required")
            .Must(j => ValidStates.Contains(j)).WithMessage("Invalid tax jurisdiction");

        RuleFor(x => x.FilingStatus).IsInEnum();
        
        RuleFor(x => x.Allowances)
            .InclusiveBetween(0, 99).WithMessage("Allowances must be between 0 and 99");
        
        RuleFor(x => x.AdditionalWithholding)
            .GreaterThanOrEqualTo(0).WithMessage("Additional withholding cannot be negative");
        
        RuleFor(x => x.EffectiveDate).NotEmpty();
        
        RuleFor(x => x.DependentCredits)
            .GreaterThanOrEqualTo(0).When(x => x.DependentCredits.HasValue);
        
        RuleFor(x => x.OtherIncome)
            .GreaterThanOrEqualTo(0).When(x => x.OtherIncome.HasValue);
        
        RuleFor(x => x.Deductions)
            .GreaterThanOrEqualTo(0).When(x => x.Deductions.HasValue);
        
        RuleFor(x => x.Notes)
            .MaximumLength(500).When(x => !string.IsNullOrEmpty(x.Notes));
    }
}
