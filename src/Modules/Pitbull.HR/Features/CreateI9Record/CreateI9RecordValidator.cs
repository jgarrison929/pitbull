using FluentValidation;

namespace Pitbull.HR.Features.CreateI9Record;

public class CreateI9RecordValidator : AbstractValidator<CreateI9RecordCommand>
{
    private static readonly string[] ValidCitizenshipStatuses = { "Citizen", "NationalUS", "LPR", "Alien" };

    public CreateI9RecordValidator()
    {
        RuleFor(x => x.EmployeeId).NotEmpty();
        RuleFor(x => x.Section1CompletedDate).NotEmpty();
        RuleFor(x => x.CitizenshipStatus).NotEmpty().Must(s => ValidCitizenshipStatuses.Contains(s))
            .WithMessage("Citizenship status must be Citizen, NationalUS, LPR, or Alien");
        RuleFor(x => x.EmploymentStartDate).NotEmpty();
        
        // Alien number required for LPR
        RuleFor(x => x.AlienNumber).NotEmpty()
            .When(x => x.CitizenshipStatus == "LPR")
            .WithMessage("Alien number required for Lawful Permanent Residents");
        
        // Work auth expiration required for Alien status
        RuleFor(x => x.WorkAuthorizationExpires).NotEmpty()
            .When(x => x.CitizenshipStatus == "Alien")
            .WithMessage("Work authorization expiration required for Alien status");
        
        RuleFor(x => x.AlienNumber).MaximumLength(20).When(x => !string.IsNullOrEmpty(x.AlienNumber));
        RuleFor(x => x.I94Number).MaximumLength(20).When(x => !string.IsNullOrEmpty(x.I94Number));
        RuleFor(x => x.ForeignPassportNumber).MaximumLength(30).When(x => !string.IsNullOrEmpty(x.ForeignPassportNumber));
        RuleFor(x => x.ForeignPassportCountry).MaximumLength(50).When(x => !string.IsNullOrEmpty(x.ForeignPassportCountry));
        RuleFor(x => x.Notes).MaximumLength(500).When(x => !string.IsNullOrEmpty(x.Notes));
    }
}
