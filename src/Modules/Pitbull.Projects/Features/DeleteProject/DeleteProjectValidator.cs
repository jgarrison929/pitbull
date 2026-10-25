using FluentValidation;

namespace Pitbull.Projects.Features.DeleteProject;

public class DeleteProjectValidator : AbstractValidator<DeleteProjectCommand>
{
    public DeleteProjectValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Project ID is required");
    }
}
