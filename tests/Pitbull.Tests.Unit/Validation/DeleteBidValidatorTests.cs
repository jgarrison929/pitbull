using FluentValidation.TestHelper;
using Pitbull.Bids.Features.DeleteBid;

namespace Pitbull.Tests.Unit.Validation;

public sealed class DeleteBidValidatorTests
{
    private readonly DeleteBidValidator _validator = new();

    [Fact]
    public void Validate_WithValidId_ShouldNotHaveErrors()
    {
        var command = new DeleteBidCommand(Guid.NewGuid());
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_WithEmptyId_ShouldHaveError()
    {
        var command = new DeleteBidCommand(Guid.Empty);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Id)
            .WithErrorMessage("Bid ID is required");
    }
}
