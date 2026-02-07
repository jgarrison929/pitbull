using FluentValidation.TestHelper;
using Pitbull.Projects.Features.DeleteProject;

namespace Pitbull.Tests.Unit.Validation;

public sealed class DeleteProjectValidatorTests
{
    private readonly DeleteProjectValidator _validator = new();

    [Fact]
    public void Validate_WithValidId_ShouldNotHaveErrors()
    {
        var command = new DeleteProjectCommand(Guid.NewGuid());
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_WithEmptyId_ShouldHaveError()
    {
        var command = new DeleteProjectCommand(Guid.Empty);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Id)
            .WithErrorMessage("Project ID is required");
    }
}
