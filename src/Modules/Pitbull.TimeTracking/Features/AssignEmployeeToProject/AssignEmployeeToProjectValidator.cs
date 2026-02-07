using FluentValidation;

namespace Pitbull.TimeTracking.Features.AssignEmployeeToProject;

public class AssignEmployeeToProjectValidator : AbstractValidator<AssignEmployeeToProjectCommand>
{
    public AssignEmployeeToProjectValidator()
    {
        RuleFor(x => x.EmployeeId)
            .NotEmpty().WithMessage("Employee ID is required");

        RuleFor(x => x.ProjectId)
            .NotEmpty().WithMessage("Project ID is required");

        RuleFor(x => x.Role)
            .IsInEnum().WithMessage("Invalid assignment role");

        RuleFor(x => x.Notes)
            .MaximumLength(500).WithMessage("Notes cannot exceed 500 characters")
            .When(x => !string.IsNullOrEmpty(x.Notes));

        // EndDate must be after StartDate if both are provided
        RuleFor(x => x.EndDate)
            .GreaterThan(x => x.StartDate)
            .When(x => x.StartDate.HasValue && x.EndDate.HasValue)
            .WithMessage("End date must be after start date");
    }
}
