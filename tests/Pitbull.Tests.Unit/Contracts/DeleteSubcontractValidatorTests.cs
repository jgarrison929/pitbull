using FluentAssertions;
using FluentValidation.TestHelper;
using Pitbull.Contracts.Features.DeleteSubcontract;

namespace Pitbull.Tests.Unit.Contracts;

public sealed class DeleteSubcontractValidatorTests
{
    private readonly DeleteSubcontractValidator _validator = new();

    [Fact]
    public void Validate_WithValidId_ShouldNotHaveErrors()
    {
        var command = new DeleteSubcontractCommand(Guid.NewGuid());
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_WithEmptyId_ShouldHaveError()
    {
        var command = new DeleteSubcontractCommand(Guid.Empty);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Id)
            .WithErrorMessage("Subcontract ID is required");
    }
}
