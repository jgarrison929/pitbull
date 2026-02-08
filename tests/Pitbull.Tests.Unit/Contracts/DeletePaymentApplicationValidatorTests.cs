using FluentValidation.TestHelper;
using Pitbull.Contracts.Features.DeletePaymentApplication;

namespace Pitbull.Tests.Unit.Contracts;

public sealed class DeletePaymentApplicationValidatorTests
{
    private readonly DeletePaymentApplicationValidator _validator = new();

    [Fact]
    public void Validate_WithValidId_ShouldNotHaveErrors()
    {
        var command = new DeletePaymentApplicationCommand(Guid.NewGuid());
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_WithEmptyId_ShouldHaveError()
    {
        var command = new DeletePaymentApplicationCommand(Guid.Empty);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Id)
            .WithErrorMessage("Payment application ID is required");
    }
}
