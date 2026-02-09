using FluentValidation;

namespace Pitbull.HR.Features.CreateEVerifyCase;

public class CreateEVerifyCaseValidator : AbstractValidator<CreateEVerifyCaseCommand>
{
    public CreateEVerifyCaseValidator()
    {
        RuleFor(x => x.EmployeeId).NotEmpty();
        RuleFor(x => x.CaseNumber).NotEmpty().MaximumLength(30);
        RuleFor(x => x.SubmittedDate).NotEmpty();
        RuleFor(x => x.SubmittedBy).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Notes).MaximumLength(500).When(x => !string.IsNullOrEmpty(x.Notes));
    }
}
