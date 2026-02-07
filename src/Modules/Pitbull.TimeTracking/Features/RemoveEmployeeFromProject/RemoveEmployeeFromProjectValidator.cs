using FluentValidation;

namespace Pitbull.TimeTracking.Features.RemoveEmployeeFromProject;

public class RemoveEmployeeFromProjectValidator : AbstractValidator<RemoveEmployeeFromProjectCommand>
{
    public RemoveEmployeeFromProjectValidator()
    {
        RuleFor(x => x.AssignmentId)
            .NotEmpty().WithMessage("Assignment ID is required");
    }
}

public class RemoveEmployeeFromProjectByIdsValidator : AbstractValidator<RemoveEmployeeFromProjectByIdsCommand>
{
    public RemoveEmployeeFromProjectByIdsValidator()
    {
        RuleFor(x => x.EmployeeId)
            .NotEmpty().WithMessage("Employee ID is required");

        RuleFor(x => x.ProjectId)
            .NotEmpty().WithMessage("Project ID is required");
    }
}
