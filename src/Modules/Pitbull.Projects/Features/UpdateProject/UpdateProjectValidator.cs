using FluentValidation;

namespace Pitbull.Projects.Features.UpdateProject;

public class UpdateProjectValidator : AbstractValidator<UpdateProjectCommand>
{
    public UpdateProjectValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Project ID is required");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Project name is required")
            .MaximumLength(200).WithMessage("Project name cannot exceed 200 characters");

        RuleFor(x => x.Number)
            .NotEmpty().WithMessage("Project number is required")
            .MaximumLength(50).WithMessage("Project number cannot exceed 50 characters");

        RuleFor(x => x.Status)
            .IsInEnum().WithMessage("Invalid project status");

        RuleFor(x => x.Type)
            .IsInEnum().WithMessage("Invalid project type");

        RuleFor(x => x.ContractAmount)
            .GreaterThanOrEqualTo(0).WithMessage("Contract amount cannot be negative");

        // Optional field validation
        RuleFor(x => x.Description)
            .MaximumLength(1000).WithMessage("Description cannot exceed 1000 characters")
            .When(x => !string.IsNullOrEmpty(x.Description));

        RuleFor(x => x.ClientEmail)
            .EmailAddress().WithMessage("Invalid email format")
            .MaximumLength(256).WithMessage("Email cannot exceed 256 characters")
            .When(x => !string.IsNullOrEmpty(x.ClientEmail));

        RuleFor(x => x.EstimatedCompletionDate)
            .GreaterThan(x => x.StartDate)
            .When(x => x.StartDate.HasValue && x.EstimatedCompletionDate.HasValue)
            .WithMessage("Estimated completion date must be after start date");
    }
}
