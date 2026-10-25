using FluentValidation.TestHelper;
using Pitbull.Contracts.Features.DeleteChangeOrder;

namespace Pitbull.Tests.Unit.Contracts;

public sealed class DeleteChangeOrderValidatorTests
{
    private readonly DeleteChangeOrderValidator _validator = new();

    [Fact]
    public void Validate_WithValidId_ShouldNotHaveErrors()
    {
        var command = new DeleteChangeOrderCommand(Guid.NewGuid());
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_WithEmptyId_ShouldHaveError()
    {
        var command = new DeleteChangeOrderCommand(Guid.Empty);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Id)
            .WithErrorMessage("Change order ID is required");
    }
}
