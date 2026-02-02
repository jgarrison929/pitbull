using FluentValidation;

namespace Pitbull.Projects.Features.CreateProject;

public class CreateProjectValidator : AbstractValidator<CreateProjectCommand>
{
    public CreateProjectValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Project name is required")
            .MaximumLength(200);

        RuleFor(x => x.Number)
            .NotEmpty().WithMessage("Project number is required")
            .MaximumLength(50);

        RuleFor(x => x.Description)
            .MaximumLength(2000);

        RuleFor(x => x.ContractAmount)
            .GreaterThanOrEqualTo(0).WithMessage("Contract amount cannot be negative");

        RuleFor(x => x.ClientEmail)
            .EmailAddress().When(x => !string.IsNullOrEmpty(x.ClientEmail));

        RuleFor(x => x.EstimatedCompletionDate)
            .GreaterThan(x => x.StartDate)
            .When(x => x.StartDate.HasValue && x.EstimatedCompletionDate.HasValue)
            .WithMessage("Estimated completion date must be after start date");
    }
}
